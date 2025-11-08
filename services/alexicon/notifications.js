const express = require('express');
const pool = require('../../utils/dbConn');
const getIdByToken = require('../../utils/getIdByToken');

const router = express.Router();

router.post('/notifications', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1] || req.body.token;
        if (!token)
            return res.status(401).json({ error: 'No token provided' });

        const userId = await getIdByToken(token);
        if (!userId)
            return res.status(401).json({ error: 'Invalid token' });

        const [notifications] = await pool.execute(
            `SELECT id, seen, event, content, service, notif_date FROM notifications WHERE owner_id = ? ORDER BY notif_date DESC LIMIT 100`,
            [userId]
        );

        const parsedNotifications = notifications.map(n => {
            let contentParsed = null;
            try { contentParsed = JSON.parse(n.content); } catch { contentParsed = n.content; }
            return {    
                id: n.id,
                seen: !!n.seen,
                event: n.event,
                content: JSON.parse(n.content),
                service: n.service,
                notif_date: n.notif_date,
            };
        });

        res.json({ notifications: parsedNotifications });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
