const express = require('express');
const pool = require('../../utils/dbConn');
const getIdByToken = require('../../utils/getIdByToken');
const { emitNotification } = require('../../utils/socket');

const router = express.Router();

router.post('/message', async (req, res) => {
    const { media = [], content = '', targetId, conversationId = 0 } = req.body;

    // Auth
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer '))
        return res.status(401).json({ status: 'error', message: 'Missing or invalid token.' });
    const token = authHeader.split(' ')[1];
    const senderId = await getIdByToken(token);
    if (!senderId)
        return res.status(403).json({ status: 'error', message: 'Invalid token.' });

    // Params
    const tid = Number(targetId);
    const cid = Number(conversationId);
    if (!Number.isFinite(tid) || !Number.isFinite(cid))
        return res.status(400).json({ status: 'error', message: 'Invalid or missing fields.' });

    try {
        // 1) Insertar mensaje
        const [msgResult] = await pool.execute(
            `INSERT INTO messages (sender_id, receiver_id, conversation_id, content, media, msg_date) VALUES (?, ?, ?, ?, ?, NOW())`,
            [senderId, tid, cid, content, JSON.stringify(media)]
        );
        const messageId = msgResult.insertId;

        // 2) Datos del sender
        const [rows] = await pool.execute(
            `SELECT id, name, surname, current_profile_pic, services
            FROM users
            WHERE id = ?
            LIMIT 1`,
            [senderId]
        );
        const senderInfo = rows[0];
        if (!senderInfo) throw new Error('Sender not found');

        // 3) Notificación persistente (preview)
        await emitNotification(tid, 'message_preview', 'yipnet', {
            type: 'message',
            messageId,
            sender_id: senderId,
            user: {
                id: senderInfo.id,
                name: senderInfo.name,
                surname: senderInfo.surname,
                current_profile_pic: senderInfo.current_profile_pic,
                services: senderInfo.services
            },
            preview: (content || '').slice(0, 200),
            mediaCount: Array.isArray(media) ? media.length : 0
        });

        // 4) Emitir el mensaje completo en tiempo real (no persistente)
        const [msgRows] = await pool.execute(
            `SELECT id, content, media, msg_date
            FROM messages
            WHERE id = ?
            LIMIT 1`,
            [messageId]
        );
        if (!msgRows.length) throw new Error('Message not found after insertion.');

        await emitNotification(tid, 'message', 'yipnet', {
            id: msgRows[0].id,
            content: msgRows[0].content,
            media: JSON.parse(msgRows[0].media || '[]'),
            msg_date: msgRows[0].msg_date
        }, false);

        return res.json({ status: 'ok', message: 'Message and notification sent.', messageId });
    } catch (error) {
        console.error('Error in message endpoint:', error);
        return res.status(500).json({ status: 'error', message: 'Internal server error.' });
    }
});

module.exports = router