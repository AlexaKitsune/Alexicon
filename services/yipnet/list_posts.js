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

router.get('/list_posts/:targetId', async (req, res) => {
    const targetId = parseInt(req.params.targetId, 10);
    if (isNaN(targetId)) {
        return res.status(400).json({ status: "error", message: "Invalid target ID." });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ status: "error", message: "Missing or invalid token." });
    }

    const token = authHeader.split(" ")[1];
    const requesterId = await getIdByToken(token);

    if (!requesterId) {
        return res.status(401).json({ status: "error", message: "Invalid token." });
    }

    try {
        const conn = await getConnection();

        // Verificar si hay bloqueo entre requester y target
        const [userRows] = await conn.execute(
            "SELECT list_negative, list_negative_external FROM users WHERE id = ?",
            [requesterId]
        );

        if (userRows.length === 0) {
            await conn.end();
            return res.status(404).json({ status: "error", message: "Requesting user not found." });
        }

        const { list_negative, list_negative_external } = userRows[0];
        const negativeList = tryParseJson(list_negative) || [];
        const externalList = tryParseJson(list_negative_external) || [];

        if (negativeList.includes(targetId) || externalList.includes(targetId)) {
            await conn.end();
            return res.json({ status: "ok", post_list: [] });
        }

        let query = `
            SELECT p.*, u.name, u.surname, u.current_profile_pic, u.services 
            FROM posts p
            JOIN users u ON p.owner_id = u.id
            WHERE p.owner_id = ?
        `;

        const params = [targetId];

        if (requesterId !== targetId) {
            query += " AND p.private_post = 0";
        }

        query += " ORDER BY p.post_date DESC";

        const [rows] = await conn.execute(query, params);
        await conn.end();

        const posts = rows.map(row => {
            return {
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
            };
        });

        return res.json({ status: "ok", post_list: posts });
    } catch (error) {
        console.error("Error retrieving posts:", error);
        return res.status(500).json({ status: "error", message: "Database connection error." });
    }
});

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

module.exports = router;