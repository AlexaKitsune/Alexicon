const express = require('express');
const mysql = require('mysql2/promise');
const getIdByToken = require('../../utils/getIdByToken');
const { emitToUser } = require('../../utils/socket');
const router = express.Router();

async function getConnection() {
    return await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASS,
        database: process.env.DB_NAME,
    });
}

router.post('/message', async (req, res) => {
    const { media = [], content = '', targetId, conversationId = 0 } = req.body;

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ status: 'error', message: 'Missing or invalid token.' });
    }

    const token = authHeader.split(' ')[1];
    const senderId = await getIdByToken(token);

    if (!senderId) {
        return res.status(403).json({ status: 'error', message: 'Invalid token.' });
    }

    if (
        targetId === undefined || isNaN(targetId) ||
        conversationId === undefined || isNaN(conversationId)
    ) {
        return res.status(400).json({ status: 'error', message: 'Invalid or missing fields.' });
    }

    try {
        const conn = await getConnection();

        // 1. Insertar mensaje
        const [msgResult] = await conn.execute(
            `INSERT INTO messages 
             (sender_id, receiver_id, conversation_id, content, media, msg_date) 
             VALUES (?, ?, ?, ?, ?, NOW())`,
            [
                senderId,
                targetId,
                conversationId,
                content,
                JSON.stringify(media)
            ]
        );

        const messageId = msgResult.insertId;

        // 2. Obtener datos del sender
        const [rows] = await conn.execute(
            `SELECT id, name, surname, current_profile_pic, services 
             FROM users WHERE id = ?`,
            [senderId]
        );

        const senderInfo = rows[0];
        if (!senderInfo) throw new Error("Sender not found");

        const notifContent = {
            id: senderInfo.id,
            name: senderInfo.name,
            surname: senderInfo.surname,
            current_profile_pic: senderInfo.current_profile_pic,
            services: senderInfo.services
        };

        // 3. Insertar notificación

        // 4. Emitir al front por WebSocket
        emitToUser(targetId, 'yipnet_message', {
            message: 'You have a new message',
            messageId,
            timestamp: new Date().toISOString()
        });

        await conn.end();

        return res.json({ status: 'ok', message: 'Message and notification sent.', messageId });

    } catch (error) {
        console.error("Error in message endpoint:", error);
        return res.status(500).json({ status: 'error', message: 'Internal server error.' });
    }
});

module.exports = router;
