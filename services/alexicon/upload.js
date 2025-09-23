const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const mimeTypes = require('mime-types');

const getIdByToken = require('../../utils/getIdByToken');
const pool = require('../../utils/dbIndex');

const router = express.Router();

const ALLOWED_PATHS = ['alexicon', 'yipnet']; // carpetas válidas (servicios)
const ALLOWED_EXTENSIONS = [
  '.jpg', '.jpeg', '.png', '.gif', '.webp',
  '.mp4', '.mov', '.webm', '.ogg',
  '.pdf', '.docx', '.xls', '.xlsx',
  '.ttf', '.otf', '.woff',
  '.html', '.htm',
  '.psd', '.txt', '.xml', '.csv',
  '.py', '.cpp', '.js', '.css', '.json', '.bat'
];
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

// Multer en memoria (para poder comprimir imágenes si aplica)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_EXTENSIONS.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no permitido.'));
    }
  }
}).single('file');

router.post('/upload', async (req, res) => {
  upload(req, res, async function (err) {
    if (err) {
      return res.status(400).json({ status: 'error', message: err.message });
    }

    // --- Auth ---
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ status: 'error', message: 'Token requerido.' });
    }
    const token = authHeader.split(" ")[1];
    const userId = await getIdByToken(token);
    if (!userId) {
      return res.status(401).json({ status: 'error', message: 'Token inválido.' });
    }

    // --- Inputs ---
    const file = req.file;
    let targetPath = req.body.targetPath; // esperado: "<service>/<userId>[/subcarpetas]"
    if (!file || !targetPath) {
      return res.status(400).json({ status: 'error', message: 'Falta archivo o ruta.' });
    }

    // --- Sanitiza/normaliza ruta ---
    let safePath = path.normalize(targetPath)
      .replace(/^(\.\.(\/|\\|$))+/, '')
      .replace(/^\/+/, '');

    const pathParts = safePath.split('/').filter(Boolean);
    const service = pathParts[0];

    if (!ALLOWED_PATHS.includes(service)) {
      return res.status(400).json({ status: 'error', message: 'Ruta de destino no permitida.' });
    }

    // Fuerza que el segundo segmento sea el userId real (para evitar subir a carpetas ajenas)
    const ownerInPath = pathParts[1];
    if (!ownerInPath || String(ownerInPath) !== String(userId)) {
      // si el cliente no pasó el userId correcto, lo corregimos
      const tail = pathParts.slice(2); // subcarpetas (si hay)
      safePath = path.posix.join(service, String(userId), ...tail);
    }

    const storagePath = path.join(__dirname, '../../storage', safePath);
    fs.mkdirSync(storagePath, { recursive: true });

    // --- Nombre final (evita colisión) ---
    const originalExt = path.extname(file.originalname);
    const originalBase = path.basename(file.originalname, originalExt);
    let finalName = file.originalname;
    let finalPath = path.join(storagePath, finalName);

    if (fs.existsSync(finalPath)) {
      const timestamp = Date.now();
      finalName = `${originalBase}_${timestamp}${originalExt}`;
      finalPath = path.join(storagePath, finalName);
    }

    const ext = originalExt.toLowerCase();

    try {
      // --- Guardado/compresión ---
      if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext) && file.size > 1024 * 1024) {
        // Comprimir si >1MB (ajusta a tu gusto)
        await sharp(file.buffer)
          .resize({ width: 1920 }) // opcional
          .jpeg({ quality: 80 })
          .toFile(finalPath);
      } else {
        fs.writeFileSync(finalPath, file.buffer);
      }

      // --- Metadatos para tabla 'files' ---
      // rel_path en formato POSIX (con /) para que sea consistente
      const relativePath = path.posix.join(safePath, finalName);
      const mimeType = mimeTypes.lookup(finalPath) || 'application/octet-stream';
      const fileSize = fs.statSync(finalPath).size;

      // ACL mínima (puedes enviar en body: visibility, allowedUsers)
      // visibility: 'private' | 'public' | 'custom'
      const visRaw = (req.body.visibility || 'private').toString().toLowerCase();
      const visibility = ['private', 'public', 'custom'].includes(visRaw) ? visRaw : 'private';

      // allowedUsers: array de IDs; puede venir como JSON string o array
      let allowedUsers = [];
      if (visibility === 'custom') {
        if (Array.isArray(req.body.allowedUsers)) {
          allowedUsers = req.body.allowedUsers;
        } else if (typeof req.body.allowedUsers === 'string') {
          try {
            const parsed = JSON.parse(req.body.allowedUsers);
            if (Array.isArray(parsed)) allowedUsers = parsed;
          } catch (_) { /* ignore parse error */ }
        }
        // Normaliza a enteros únicos
        allowedUsers = [...new Set(allowedUsers.map(n => parseInt(n, 10)).filter(Number.isFinite))];
      }

      // --- Inserta en 'files' ---
      const [result] = await pool.query(
        `INSERT INTO files (rel_path, mime_type, size, visibility, allowed_users)
         VALUES (?, ?, ?, ?, ?)`,
        [
          relativePath,
          mimeType,
          fileSize,
          visibility,
          JSON.stringify(allowedUsers)
        ]
      );
      const fileId = result.insertId;

      // --- Respuesta ---
      return res.json({
        status: 'ok',
        fileId,
        filename: finalName,
        relativePath,              // lo mantengo por compatibilidad
        mediaUrl: `/media/file/${fileId}` // endpoint protegido
      });
    } catch (e) {
      console.error("Error al guardar/registrar archivo:", e);
      return res.status(500).json({ status: 'error', message: 'No se pudo guardar el archivo.' });
    }
  });
});

module.exports = router;
