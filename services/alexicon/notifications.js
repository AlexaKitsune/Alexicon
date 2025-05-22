const express = require('express');
const mysql = require('mysql2/promise');
const getIdByToken = require('../../utils/getIdByToken');

const router = express.Router();

async function getConnection() {
    return await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASS,
        database: process.env.DB_NAME,
    });
}

router.post('/notifications', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1] || req.body.token;
        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const userId = await getIdByToken(token);
        if (!userId) {
            return res.status(401).json({ error: 'Invalid token' });
        }

        const conn = await getConnection();

        const [notifications] = await conn.query(
            `SELECT id, seen, content, service, notif_date
             FROM notifications
             WHERE owner_id = ?
             ORDER BY notif_date DESC
             LIMIT 100`,
            [userId]
        );

        const parsedNotifications = notifications.map(n => ({
            id: n.id,
            seen: !!n.seen,
            content: JSON.parse(n.content),
            service: n.service,
            notif_date: n.notif_date,
        }));

        await conn.end();

        res.json({ notifications: parsedNotifications });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
