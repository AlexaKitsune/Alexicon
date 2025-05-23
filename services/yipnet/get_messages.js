const express = require('express');
const mysql = require('mysql2/promise');
const getIdByToken = require('../../utils/getIdByToken');
const router = express.Router();

// Conexión a la base de datos
async function getConnection() {
    return await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASS,
        database: process.env.DB_NAME,
    });
}

// GET /alexicon/messages?user=123  o  /alexicon/messages?conversation=456
router.get('/get_messages', async (req, res) => {
    const { user, conversation } = req.query;

    // Validar autenticación
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ status: 'error', message: 'Missing or invalid token.' });
    }

    const token = authHeader.split(' ')[1];
    const userId = await getIdByToken(token);

    if (!userId) {
        return res.status(403).json({ status: 'error', message: 'Invalid token.' });
    }

    let conn;
    try {
        conn = await getConnection();
        let query = '';
        let values = [];

        // Si se recibe un parámetro "user"
        if (user && !isNaN(user)) {
            query = `
                SELECT * FROM messages
                WHERE (sender_id = ? AND receiver_id = ?)
                   OR (sender_id = ? AND receiver_id = ?)
                ORDER BY msg_date ASC
            `;
            values = [userId, user, user, userId];

        // Si se recibe un parámetro "conversation"
        } else if (conversation && !isNaN(conversation)) {
            query = `
                SELECT * FROM messages
                WHERE conversation_id = ?
                ORDER BY msg_date ASC
            `;
            values = [conversation];

        } else {
            return res.status(400).json({ status: 'error', message: 'Missing or invalid parameter (user or conversation).' });
        }

        const [rows] = await conn.execute(query, values);
        await conn.end();

        return res.json({ status: 'ok', messages: rows });

    } catch (error) {
        console.error("Error in get_messages endpoint:", error);
        if (conn) await conn.end();
        return res.status(500).json({ status: 'error', message: 'Internal server error.' });
    }
});

module.exports = router;
