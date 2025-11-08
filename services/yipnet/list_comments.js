const express = require('express');
const pool = require('../../utils/dbConn');
const getIdByToken = require('../../utils/getIdByToken');

const router = express.Router();

function tryParseJson(value) {
    if (typeof value === 'string')
        try { return JSON.parse(value); } catch { return value; }
    return value;
}

router.get('/list_comments/:postId', async (req, res) => {
    const postId = Number(req.params.postId);
    if (!Number.isFinite(postId))
        return res.status(400).json({ status: "error", message: "Invalid post ID." });

    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer "))
        return res.status(401).json({ status: "error", message: "Missing or invalid token." });

    const token = authHeader.split(" ")[1];
    const userId = await getIdByToken(token);
    if (!userId)
        return res.status(401).json({ status: "error", message: "Invalid token." });

    try {
        // Verificar privacidad del post
        const [[postRow]] = await pool.execute(
            "SELECT owner_id, private_post FROM posts WHERE id = ?",
            [postId]
        );
        if (!postRow)
            return res.status(404).json({ status: "error", message: "Post not found." });
        if (postRow.private_post === 1 && postRow.owner_id !== userId)
            return res.status(403).json({ status: "error", message: "Unauthorized access to private post comments." });

        // Listas de bloqueo del usuario
        const [[userRow]] = await pool.execute(
            "SELECT list_negative, list_negative_external FROM users WHERE id = ?",
            [userId]
        );
        const negativeList = tryParseJson(userRow?.list_negative) || [];
        const externalList = tryParseJson(userRow?.list_negative_external) || [];

        // Comentarios del post
        const [rows] = await pool.execute(
            `SELECT c.*, u.name, u.surname, u.current_profile_pic, u.services
                FROM comments c
                JOIN users u ON c.owner_id = u.id
                WHERE c.post_id = ?
            ORDER BY c.comment_date ASC`,
            [postId]
        );

        // Filtrar por listas negativas y normalizar campos
        const comment_list = rows
        .filter(r => !negativeList.includes(r.owner_id) && !externalList.includes(r.owner_id))
        .map(r => ({
            id: r.id,
            post_id: r.post_id,
            owner_id: r.owner_id,
            content: r.content?.toString(),
            media: tryParseJson(r.media),
            list_vote_up: tryParseJson(r.list_vote_up),
            list_vote_down: tryParseJson(r.list_vote_down),
            list_vote_heart: tryParseJson(r.list_vote_heart),
            comment_date: r.comment_date?.toISOString?.() || r.comment_date,
            name: r.name,
            surname: r.surname,
            current_profile_pic: r.current_profile_pic,
            ai_generated: r.ai_generated,
        }));

        return res.json({ status: "ok", comment_list });
    } catch (error) {
        console.error("Error retrieving comments:", error);
        return res.status(500).json({ status: "error", message: "Database error." });
    }
});

module.exports = router;
