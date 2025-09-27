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

router.post('/comment', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ status: "error", message: "Missing or invalid token." });
    }

    const token = authHeader.split(" ")[1];
    const userId = await getIdByToken(token);
    if (!userId) {
        return res.status(401).json({ status: "error", message: "Invalid token." });
    }

    const { mode, id, postId, content, media, aiGenerated } = req.body;

    try {
        const conn = await getConnection();

        if (mode === 'delete') {
            if (!id || typeof id !== 'number') {
                await conn.end();
                return res.status(400).json({ status: "error", message: "Invalid or missing comment ID." });
            }

            const [rows] = await conn.execute(
                "SELECT owner_id FROM comments WHERE id = ?",
                [id]
            );

            if (rows.length === 0) {
                await conn.end();
                return res.status(404).json({ status: "error", message: "Comment not found." });
            }

            if (rows[0].owner_id !== userId) {
                await conn.end();
                return res.status(403).json({ status: "error", message: "Not authorized to delete this comment." });
            }

            await conn.execute("DELETE FROM comments WHERE id = ?", [id]);
            await conn.end();

            return res.json({ status: "ok", message: "Comment deleted successfully." });

        } else {
            if (!postId || typeof postId !== 'number') {
                await conn.end();
                return res.status(400).json({ status: "error", message: "Invalid or missing postId." });
            }

            if (typeof content !== 'string') {
                await conn.end();
                return res.status(400).json({ status: "error", message: "Invalid content." });
            }

            if (!Array.isArray(media)) {
                await conn.end();
                return res.status(400).json({ status: "error", message: "Media must be an array." });
            }

            // Obtener owner_id del post
            const [postRows] = await conn.execute(
                "SELECT owner_id FROM posts WHERE id = ?",
                [postId]
            );

            const postOwnerId = postRows[0]?.owner_id;
            if (!postOwnerId) {
                await conn.end();
                return res.status(404).json({ status: "error", message: "Target post not found." });
            }

            // Insertar comentario (el owner_id sigue siendo quien comenta)
            const [result] = await conn.execute(`
                INSERT INTO comments (post_id, owner_id, content, media, ai_generated)
                VALUES (?, ?, ?, ?, ?)
            `, [postId, userId, content, JSON.stringify(media), aiGenerated]);

            const commentId = result.insertId;

            // Notificar al dueño del post si no es el mismo comentarista
            if (postOwnerId !== userId) {
                const [userRows] = await conn.execute(`
                    SELECT id, name, surname, current_profile_pic, services
                    FROM users WHERE id = ?
                `, [userId]);

                const userData = userRows[0];

                const notificationContent = {
                    user: userData,
                    postId,
                    commentId
                };

                await conn.execute(`
                    INSERT INTO notifications (owner_id, content, service)
                    VALUES (?, ?, ?)
                `, [postOwnerId, JSON.stringify(notificationContent), 'yipnet']);

                emitToUser(postOwnerId, 'yipnet_notification', {
                    message: 'You have a new comment',
                    timestamp: new Date().toISOString()
                });
            }

            await conn.end();
            return res.json({ status: "ok", comment_id: commentId });
        }

    } catch (error) {
        console.error("Error in comment endpoint:", error);
        return res.status(500).json({ status: "error", message: "Database error." });
    }
});

module.exports = router;
