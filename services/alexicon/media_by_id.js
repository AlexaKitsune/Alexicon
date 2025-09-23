// services/alexicon/media_by_id.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const mimeTypes = require('mime-types');

const pool = require('../../utils/dbIndex');
const getIdByToken = require('../../utils/getIdByToken');

const router = express.Router();

// Utilidad: extrae ownerId desde 'service/owner/file...'
function getOwnerIdFromRelPath(relPath) {
  // Forzar POSIX por si la BD guarda backslashes (no debería, pero por si acaso)
  const norm = relPath.replace(/\\/g, '/').replace(/^\/+/, '');
  const parts = norm.split('/').filter(Boolean);
  // parts[0] = service, parts[1] = ownerId
  if (parts.length < 2) return null;
  const ownerId = parseInt(parts[1], 10);
  return Number.isFinite(ownerId) ? ownerId : null;
}

// Utilidad: comprueba si myId está en allowed_users (JSON)
function isUserAllowed(allowedUsersJson, myId) {
  try {
    const arr = Array.isArray(allowedUsersJson)
      ? allowedUsersJson
      : JSON.parse(allowedUsersJson || '[]');
    return arr.map(n => parseInt(n, 10)).includes(parseInt(myId, 10));
  } catch {
    return false;
  }
}

// Streaming con soporte Range
function streamFile(req, res, absPath) {
  const stat = fs.statSync(absPath);
  const type = mimeTypes.lookup(absPath) || 'application/octet-stream';

  res.setHeader('X-Filename', path.basename(absPath));
  res.setHeader('Access-Control-Expose-Headers', 'X-Filename, Content-Type');
  res.setHeader('Content-Type', type);
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Disposition', `inline; filename="${path.basename(absPath)}"`);
  // Para contenidos privados, evita cacheo persistente
  // (Si quieres cachear públicos, puedes condicionar por 'visibility')
  res.setHeader('Cache-Control', 'no-store');

  const range = req.headers.range;
  if (range) {
    const [startStr, endStr] = range.replace(/bytes=/, '').split('-');
    let start = parseInt(startStr, 10);
    let end = endStr ? parseInt(endStr, 10) : stat.size - 1;

    if (isNaN(start) || isNaN(end) || start > end || start >= stat.size) {
      res.setHeader('Content-Range', `bytes */${stat.size}`);
      return res.status(416).end();
    }

    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`);
    res.setHeader('Content-Length', end - start + 1);
    fs.createReadStream(absPath, { start, end }).pipe(res);
  } else {
    res.setHeader('Content-Length', stat.size);
    fs.createReadStream(absPath).pipe(res);
  }
}

router.get('/media/file/:id', async (req, res) => {
  try {
    // 1) Buscar metadatos en BD
    const fileId = parseInt(req.params.id, 10);
    if (!Number.isFinite(fileId)) {
      return res.status(400).json({ status: 'error', message: 'ID inválido.' });
    }

    const [rows] = await pool.query(
      `SELECT id, rel_path, visibility, allowed_users
       FROM files
       WHERE id = ?`,
      [fileId]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Archivo no encontrado.' });
    }

    const { rel_path, visibility, allowed_users } = rows[0];

    // 2) Construir ruta absoluta bajo /storage de forma segura
    //    (Nunca concatenar paths del cliente sin normalizar)
    const safeRel = rel_path.replace(/\\/g, '/').replace(/^\/+/, ''); // posix-like
    const absPath = path.join(__dirname, '../../storage', safeRel);
    const normRoot = path.join(__dirname, '../../storage');
    // Escapatoria contra path traversal:
    if (!absPath.startsWith(normRoot)) {
      return res.status(400).json({ status: 'error', message: 'Ruta inválida.' });
    }
    if (!fs.existsSync(absPath) || !fs.statSync(absPath).isFile()) {
      return res.status(404).json({ status: 'error', message: 'Archivo no disponible.' });
    }

    // 3) Resolver myId (si hay token)
    let myId = null;
    const authHeader = req.headers.authorization || '';
    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      myId = await getIdByToken(token);
    }

    // 4) ACL según la tabla minimal
    if (visibility === 'public') {
      // Público: puedes dejarlo pasar sin token
      // (Si quieres *todo* intra-suite, exige myId aquí también)
      return streamFile(req, res, absPath);
    }

    // Para privados/custom, se requiere token válido
    if (!myId) {
      return res.status(401).json({ status: 'error', message: 'Token requerido.' });
    }

    // Derivar ownerId desde rel_path: '<service>/<ownerId>/...'
    const ownerId = getOwnerIdFromRelPath(rel_path);
    if (!ownerId) {
      return res.status(500).json({ status: 'error', message: 'Metadatos inválidos.' });
    }

    if (visibility === 'private') {
      if (parseInt(myId, 10) !== parseInt(ownerId, 10)) {
        return res.status(403).json({ status: 'error', message: 'No autorizado.' });
      }
      return streamFile(req, res, absPath);
    }

    if (visibility === 'custom') {
      // Permitimos al owner siempre, y a quien esté en allowed_users
      if (parseInt(myId, 10) === parseInt(ownerId, 10) || isUserAllowed(allowed_users, myId)) {
        return streamFile(req, res, absPath);
      }
      return res.status(403).json({ status: 'error', message: 'No autorizado.' });
    }

    // Si llega aquí (valor desconocido de visibility)
    return res.status(403).json({ status: 'error', message: 'No autorizado.' });
  } catch (err) {
    console.error('media/file error:', err);
    return res.status(500).json({ status: 'error', message: 'No se pudo servir el archivo.' });
  }
});

module.exports = router;
