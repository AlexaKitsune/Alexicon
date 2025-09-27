const express = require('express');
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const getIdByToken = require('../../utils/getIdByToken');
const { emitToUser } = require('../../utils/socket'); // <<--- AÑADE ESTO

const router = express.Router();
const STORAGE_ROOT = path.join(__dirname, '../../storage');

async function getConnection() {
  return await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
  });
}

function parseMediaIdArray(value) {
  try {
    const arr = Array.isArray(value) ? value : JSON.parse(value || '[]');
    return [...new Set(arr.map(Number).filter(n => Number.isFinite(n)))];
  } catch {
    return [];
  }
}

async function deleteFilesByIds(conn, fileIds) {
  const ids = [...new Set((fileIds || []).map(Number).filter(Number.isFinite))];
  if (!ids.length) return;

  const placeholders = ids.map(() => '?').join(',');
  const [rows] = await conn.execute(
    `SELECT id, rel_path FROM files WHERE id IN (${placeholders})`,
    ids
  );

  for (const row of rows) {
    const rel = (row.rel_path || '').trim();
    if (!rel) continue;
    const fullPath = path.join(STORAGE_ROOT, rel);
    try {
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    } catch (err) {
      console.warn(`No se pudo eliminar archivo ${rel}:`, err.message);
    }
  }
  await conn.execute(`DELETE FROM files WHERE id IN (${placeholders})`, ids);
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
  if (!id || !['post', 'comment', 'message'].includes(type)) {
    return res.status(400).json({ status: 'error', message: 'Parámetros inválidos.' });
  }

  const conn = await getConnection();
  try {
    if (type === 'post') {
      // ... (igual que tu código actual de post)
    } else if (type === 'comment') {
      // ... (igual que tu código actual de comment)
    } else if (type === 'message') {
      // --- MESSAGE ---
      // 1) Traer sender, receiver y media
      const [msgRows] = await conn.execute(
        'SELECT sender_id, receiver_id, media FROM messages WHERE id = ?',
        [id]
      );
      if (!msgRows.length) {
        await conn.end();
        return res.status(404).json({ status: 'error', message: 'El mensaje no existe.' });
      }

      const { sender_id: senderId, receiver_id: receiverId, media } = msgRows[0];

      // 2) Validar que quien borra sea el autor
      if (Number(senderId) !== Number(userId)) {
        await conn.end();
        return res.status(403).json({ status: 'error', message: 'No tienes permiso para borrar este mensaje.' });
      }

      // 3) Borrar archivos (si los hay)
      const msgMediaIds = parseMediaIdArray(media);
      await deleteFilesByIds(conn, msgMediaIds);

      // 4) Borrar el mensaje
      await conn.execute('DELETE FROM messages WHERE id = ? AND sender_id = ?', [id, userId]);

      // (Opcional soft delete)
      // await conn.execute(
      //   "UPDATE messages SET deleted = 1, content = '[deleted]', media = '[]' WHERE id = ? AND sender_id = ?",
      //   [id, userId]
      // );

      // 5) Emitir a emisor y receptor
      emitToUser(senderId, 'yipnet_message_deleted', { id: Number(id) });
      emitToUser(receiverId, 'yipnet_message_deleted', { id: Number(id) });
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
