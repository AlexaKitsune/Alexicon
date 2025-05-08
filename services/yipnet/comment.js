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

    const { mode, id, postId, content, media } = req.body;

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

            const [result] = await conn.execute(`
                INSERT INTO comments (post_id, owner_id, content, media)
                VALUES (?, ?, ?, ?)
            `, [postId, userId, content, JSON.stringify(media)]);

            const commentId = result.insertId;
            await conn.end();

            return res.json({ status: "ok", comment_id: commentId });
        }

    } catch (error) {
        console.error("Error in comment endpoint:", error);
        return res.status(500).json({ status: "error", message: "Database error." });
    }
});

module.exports = router;
