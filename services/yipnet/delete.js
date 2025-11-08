const express = require('express');
const fs = require('fs');
const path = require('path');
const pool = require('../../utils/dbConn');
const getIdByToken = require('../../utils/getIdByToken');
const { emitNotification } = require('../../utils/socket');

const router = express.Router();
const STORAGE_ROOT = path.join(__dirname, '../../storage');

// Helpers
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
	if (!authHeader || !authHeader.startsWith('Bearer '))
		return res.status(401).json({ status: 'error', message: 'Token requerido.' });

	const token = authHeader.split(' ')[1];
	const userId = await getIdByToken(token);
	if (!userId)
		return res.status(401).json({ status: 'error', message: 'Token inválido.' });

	const { id, type } = req.body;
	const nid = Number(id);
	console.log("eliminando mensaje con id y nid", id, nid)
	if (!Number.isFinite(nid) || !['post', 'comment', 'message'].includes(type))
		return res.status(400).json({ status: 'error', message: 'Parámetros inválidos.' });

	let conn;
	try {
		conn = await pool.getConnection();

		if (type === 'post') {
			// ... (igual el tu código actual de post)
		} else if (type === 'comment') {
			// ... (igual el tu código actual de comment)
		} else if (type === 'message') {
			// --- MESSAGE ---
			// 1) Traer sender, receiver y media
			const [msgRows] = await conn.execute(
				'SELECT sender_id, receiver_id, media FROM messages WHERE id = ?',
				[nid]
			);
			if (!msgRows.length)
				return res.status(404).json({ status: 'error', message: 'El mensaje no existe.' });

			const { sender_id: senderId, receiver_id: receiverId, media } = msgRows[0];

			// 2) Validar que quien borra sea el autor
			if (Number(senderId) !== Number(userId))
				return res.status(403).json({ status: 'error', message: 'No tienes permiso para borrar este mensaje.' });

			// 3) Borrar el mensaje
			await conn.execute('DELETE FROM messages WHERE id = ? AND sender_id = ?', [nid, userId]);

			// 4) Borrar archivos (si los hay)
			const msgMediaIds = parseMediaIdArray(media);
			await deleteFilesByIds(conn, msgMediaIds);

			// 5) Emitir a emisor y receptor (no detenemos el flujo si falla)
			try {
				await emitNotification(senderId, 'message_deleted', 'yipnet', { id: nid }, false);
				await emitNotification(receiverId, 'message_deleted', 'yipnet', { id: nid }, false);
			} catch (notifyErr) {
				console.error('emitNotification error (message_deleted):', notifyErr);
			}
		}

		return res.json({ status: 'ok' });
	} catch (err) {
		console.error('Error en eliminación:', err);
		return res.status(500).json({ status: 'error', message: 'Error del servidor.' });
	} finally {
		if (conn) conn.release();
	}
});

module.exports = router;
