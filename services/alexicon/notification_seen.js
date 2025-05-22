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

router.post('/notification_seen', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ status: "error", message: "Missing or invalid token." });
    }

    const token = authHeader.split(" ")[1];
    const userId = await getIdByToken(token);
    if (!userId) {
        return res.status(401).json({ status: "error", message: "Invalid token." });
    }

    const { id, mode } = req.body;

    try {
        const conn = await getConnection();

        if (mode === 'all') {
            await conn.execute(
                "UPDATE notifications SET seen = 1 WHERE owner_id = ?",
                [userId]
            );
            await conn.end();
            return res.json({ status: "ok", message: "All notifications marked as seen." });

        } else {
            if (!id || typeof id !== 'number') {
                await conn.end();
                return res.status(400).json({ status: "error", message: "Invalid or missing notification ID." });
            }

            const [rows] = await conn.execute(
                "SELECT id FROM notifications WHERE id = ? AND owner_id = ?",
                [id, userId]
            );

            if (rows.length === 0) {
                await conn.end();
                return res.status(404).json({ status: "error", message: "Notification not found or unauthorized." });
            }

            await conn.execute(
                "UPDATE notifications SET seen = 1 WHERE id = ?",
                [id]
            );

            await conn.end();
            return res.json({ status: "ok", message: "Notification marked as seen." });
        }

    } catch (error) {
        console.error("Error in notification_seen endpoint:", error);
        return res.status(500).json({ status: "error", message: "Database error." });
    }
});

module.exports = router;
