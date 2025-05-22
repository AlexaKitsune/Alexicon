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

function tryParseJson(value) {
    if (typeof value === 'string') {
        try {
            return JSON.parse(value);
        } catch {
            return value;
        }
    }
    return value;
}

router.get('/list_comments/:postId', async (req, res) => {
    const postId = parseInt(req.params.postId, 10);
    if (isNaN(postId)) {
        return res.status(400).json({ status: "error", message: "Invalid post ID." });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
        return res.status(401).json({ status: "error", message: "Missing or invalid token." });
    }

    const token = authHeader.split(" ")[1];
    const userId = await getIdByToken(token);

    if (!userId) {
        return res.status(401).json({ status: "error", message: "Invalid token." });
    }

    try {
        const conn = await getConnection();

        // Obtener post y verificar privacidad
        const [[postRow]] = await conn.execute(
            "SELECT owner_id, private_post FROM posts WHERE id = ?",
            [postId]
        );

        if (!postRow) {
            await conn.end();
            return res.status(404).json({ status: "error", message: "Post not found." });
        }

        if (postRow.private_post === 1 && postRow.owner_id !== userId) {
            await conn.end();
            return res.status(403).json({ status: "error", message: "Unauthorized access to private post comments." });
        }

        // Obtener listas de bloqueo
        const [[userRow]] = await conn.execute(
            "SELECT list_negative, list_negative_external FROM users WHERE id = ?",
            [userId]
        );

        const negativeList = tryParseJson(userRow?.list_negative) || [];
        const externalList = tryParseJson(userRow?.list_negative_external) || [];

        // Obtener comentarios
        const [rows] = await conn.execute(
            `SELECT c.*, u.name, u.surname, u.current_profile_pic, u.services
             FROM comments c
             JOIN users u ON c.owner_id = u.id
             WHERE c.post_id = ?
             ORDER BY c.comment_date ASC`,
            [postId]
        );

        await conn.end();

        // Filtrar comentarios por listas negativas
        const comments = rows
            .filter(row => !negativeList.includes(row.owner_id) && !externalList.includes(row.owner_id))
            .map(row => ({
                id: row.id,
                post_id: row.post_id,
                owner_id: row.owner_id,
                content: row.content?.toString(),
                media: tryParseJson(row.media),
                list_vote_up: tryParseJson(row.list_vote_up),
                list_vote_down: tryParseJson(row.list_vote_down),
                list_vote_heart: tryParseJson(row.list_vote_heart),
                comment_date: row.comment_date?.toISOString?.() || row.comment_date,
                name: row.name,
                surname: row.surname,
                current_profile_pic: row.current_profile_pic
            }));

        return res.json({ status: "ok", comment_list: comments });
    } catch (error) {
        console.error("Error retrieving comments:", error);
        return res.status(500).json({ status: "error", message: "Database error." });
    }
});

module.exports = router;
