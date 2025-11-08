const express = require('express');
const pool = require('../../utils/dbConn');
const getIdByToken = require('../../utils/getIdByToken');

const router = express.Router();

// GET /alexicon/get_messages?user=123  ó  /alexicon/get_messages?conversation=456
router.get('/get_messages', async (req, res) => {
    const { user, conversation } = req.query;

    // Auth
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer '))
        return res.status(401).json({ status: 'error', message: 'Missing or invalid token.' });

    const token = authHeader.split(' ')[1];
    const userId = await getIdByToken(token);
    if (!userId)
        return res.status(403).json({ status: 'error', message: 'Invalid token.' });

    try {
        let sql = '';
        let params = [];

        // Conversación 1:1 con otro usuario
        const otherUserId = Number(user);
            if (Number.isFinite(otherUserId)) {
            sql = `
                SELECT *
                FROM messages
                WHERE (sender_id = ? AND receiver_id = ?)
                    OR (sender_id = ? AND receiver_id = ?)
                ORDER BY msg_date ASC`;
            params = [userId, otherUserId, otherUserId, userId];
            // Conversación por conversation_id
        } else {
            const convId = Number(conversation);
            if (!Number.isFinite(convId))
                return res.status(400).json({ status: 'error', message: 'Missing or invalid parameter (user or conversation).' });

            sql = `
                SELECT *
                FROM messages
                WHERE conversation_id = ?
                ORDER BY msg_date ASC`;
            params = [convId];
        }

        const [rows] = await pool.execute(sql, params);
        return res.json({ status: 'ok', messages: rows });

    } catch (error) {
        console.error("Error in get_messages endpoint:", error);
        return res.status(500).json({ status: 'error', message: 'Internal server error.' });
    }
});

module.exports = router;