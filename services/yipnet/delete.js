const express = require('express');
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const getIdByToken = require('../../utils/getIdByToken');

const router = express.Router();

// Ajusta si tu storage está en otra ruta
const STORAGE_ROOT = path.join(__dirname, '../../storage');

async function getConnection() {
  return await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
  });
}

/**
 * Convierte lo que venga (string JSON, array, etc.) a un array de IDs numéricos únicos.
 * Ignora todo lo que no sea número.
 */
function parseMediaIdArray(value) {
  try {
    const arr = Array.isArray(value) ? value : JSON.parse(value || '[]');
    return [...new Set(arr.map(Number).filter(n => Number.isFinite(n)))];
  } catch {
    return [];
  }
}

/**
 * Dado un set de IDs de files, obtiene sus rutas (rel_path), elimina los archivos del disco
 * y borra los registros de la tabla `files`.
 */
async function deleteFilesByIds(conn, fileIds) {
  const ids = [...new Set((fileIds || []).map(Number).filter(Number.isFinite))];
  if (!ids.length) return;

  const placeholders = ids.map(() => '?').join(',');
  const [rows] = await conn.execute(
    `SELECT id, rel_path FROM files WHERE id IN (${placeholders})`,
    ids
  );

  // Eliminar archivos físicos
  for (const row of rows) {
    const rel = (row.rel_path || '').trim();
    if (!rel) continue;

    const fullPath = path.join(STORAGE_ROOT, rel);
    try {
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    } catch (err) {
      console.warn(`No se pudo eliminar archivo ${rel}:`, err.message);
    }
  }

  // Borrar registros en tabla files
  await conn.execute(
    `DELETE FROM files WHERE id IN (${placeholders})`,
    ids
  );
}

router.post('/delete', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ status: 'error', message: 'Token requerido.' });
  }

  const token = authHeader.split(' ')[1];
  const userId = await getIdByToken(token);
  if (!userId) {
    return res.status(401).json({ status: 'error', message: 'Token inválido.' });
  }

  const { id, type } = req.body;
  if (!id || !['post', 'comment'].includes(type)) {
    return res.status(400).json({ status: 'error', message: 'Parámetros inválidos.' });
  }

  const conn = await getConnection();

  try {
    if (type === 'post') {
      // Verificar post y obtener sus media IDs
      const [postRows] = await conn.execute(
        'SELECT media FROM posts WHERE id = ? AND owner_id = ?',
        [id, userId]
      );
      if (!postRows.length) {
        await conn.end();
        return res.status(403).json({ status: 'error', message: 'No tienes permiso o el post no existe.' });
      }

      const postMediaIds = parseMediaIdArray(postRows[0].media);

      // Traer comentarios del post y sus medias
      const [commentRows] = await conn.execute(
        'SELECT media FROM comments WHERE post_id = ?',
        [id]
      );
      const commentMediaIds = commentRows.flatMap(row => parseMediaIdArray(row.media));

      // Borrar todos los files (disco + registros)
      const allFileIds = [...postMediaIds, ...commentMediaIds];
      await deleteFilesByIds(conn, allFileIds);

      // Borrar comentarios y post
      await conn.execute('DELETE FROM comments WHERE post_id = ?', [id]);
      await conn.execute('DELETE FROM posts WHERE id = ? AND owner_id = ?', [id, userId]);

    } else if (type === 'comment') {
      // Verificar comentario y obtener sus media IDs
      const [commentRows] = await conn.execute(
        'SELECT media FROM comments WHERE id = ? AND owner_id = ?',
        [id, userId]
      );
      if (!commentRows.length) {
        await conn.end();
        return res.status(403).json({ status: 'error', message: 'No tienes permiso o el comentario no existe.' });
      }

      const commentMediaIds = parseMediaIdArray(commentRows[0].media);

      // Borrar files y el comentario
      await deleteFilesByIds(conn, commentMediaIds);
      await conn.execute('DELETE FROM comments WHERE id = ? AND owner_id = ?', [id, userId]);
    }

    await conn.end();
    return res.json({ status: 'ok' });

  } catch (err) {
    console.error('Error en eliminación:', err);
    if (conn) await conn.end();
    return res.status(500).json({ status: 'error', message: 'Error del servidor.' });
  }
});

module.exports = router;
