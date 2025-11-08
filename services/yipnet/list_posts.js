const express = require('express');
const pool = require('../../utils/dbConn');
const getIdByToken = require('../../utils/getIdByToken');

const router = express.Router();

router.get('/list_posts/:targetId', async (req, res) => {
    const targetId = Number(req.params.targetId);
    if (!Number.isFinite(targetId))
        return res.status(400).json({ status: "error", message: "Invalid target ID." });

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer "))
        return res.status(401).json({ status: "error", message: "Missing or invalid token." });

    const token = authHeader.split(" ")[1];
    const requesterId = await getIdByToken(token);
    if (!requesterId)
        return res.status(401).json({ status: "error", message: "Invalid token." });

    try {
        // Verificar listas de bloqueo del solicitante
        const [[userRow]] = await pool.execute(
            "SELECT list_negative, list_negative_external FROM users WHERE id = ?",
            [requesterId]
        );

        if (!userRow)
            return res.status(404).json({ status: "error", message: "Requesting user not found." });

        const negativeList = tryParseJson(userRow.list_negative) || [];
        const externalList = tryParseJson(userRow.list_negative_external) || [];

        if (negativeList.includes(targetId) || externalList.includes(targetId))
            return res.json({ status: "ok", post_list: [] });

        // Consulta de posts del target
        let sql = `
            SELECT p.*, u.name, u.surname, u.current_profile_pic, u.services
                FROM posts p
                JOIN users u ON p.owner_id = u.id
            WHERE p.owner_id = ?`;
        const params = [targetId];

        if (Number(requesterId) !== targetId)
            sql += " AND p.private_post = 0";

        sql += " ORDER BY p.post_date DESC";

        const [rows] = await pool.execute(sql, params);

        const posts = rows.map(row => ({
            id: row.id,
            owner_id: row.owner_id,
            content: row.content?.toString(),
            media: tryParseJson(row.media),
            shared_by_list: tryParseJson(row.shared_by_list),
            share_id: row.share_id,
            private_post: row.private_post,
            nsfw_post: row.nsfw_post,
            comment_count: row.comment_count,
            list_vote_heart: tryParseJson(row.list_vote_heart),
            list_vote_up: tryParseJson(row.list_vote_up),
            list_vote_down: tryParseJson(row.list_vote_down),
            services: tryParseJson(row.services),
            post_date: row.post_date?.toISOString?.() || row.post_date,
            name: row.name,
            surname: row.surname,
            current_profile_pic: row.current_profile_pic,
            ai_generated: row.ai_generated,
        }));

        return res.json({ status: "ok", post_list: posts });
    } catch (error) {
        console.error("Error retrieving posts:", error);
        return res.status(500).json({ status: "error", message: "Database connection error." });
    }
});

function tryParseJson(value) {
    if (typeof value === 'string')
        try { return JSON.parse(value); } catch { return value; }
    return value;
}

module.exports = router;