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

router.post('/retrieve_posts', async (req, res) => {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.some(id => typeof id !== 'number')) {
        return res.status(400).json({ response: 'Invalid ids array.' });
    }

    if (ids.length === 0) {
        return res.json([]); // devuelve vacío si no hay ids
    }

    // Obtener userId desde el token
    let userId = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.split(" ")[1];
        userId = await getIdByToken(token);
    }

    try {
        const conn = await getConnection();

        const placeholders = ids.map(() => '?').join(',');
        const [rows] = await conn.execute(
            `SELECT p.id, p.owner_id, p.content, p.media, p.shared_by_list, p.share_id,
                    p.private_post, p.nsfw_post, p.comment_count, p.list_vote_heart,
                    p.list_vote_up, p.list_vote_down, p.post_date,
                    u.name, u.surname, u.current_profile_pic, u.services
             FROM posts p
             JOIN users u ON p.owner_id = u.id
             WHERE p.id IN (${placeholders})`,
            ids
        );

        await conn.end();

        // Parsear JSONs en los campos que lo necesiten
        const tryParseJson = (value) => {
            if (typeof value === 'string') {
                try {
                    return JSON.parse(value);
                } catch {
                    return value;
                }
            }
            return value;
        };

        // Filtrar posts privados si no es el owner
        const result = rows
            .filter(post => post.private_post !== 1 || post.owner_id === userId)
            .map(post => ({
                id: post.id,
                owner_id: post.owner_id,
                content: post.content,
                media: tryParseJson(post.media),
                shared_by_list: tryParseJson(post.shared_by_list),
                share_id: post.share_id,
                private_post: post.private_post,
                nsfw_post: post.nsfw_post,
                comment_count: post.comment_count,
                list_vote_heart: tryParseJson(post.list_vote_heart),
                list_vote_up: tryParseJson(post.list_vote_up),
                list_vote_down: tryParseJson(post.list_vote_down),
                services: tryParseJson(post.services),
                post_date: post.post_date?.toISOString?.() || post.post_date,
                name: post.name,
                surname: post.surname,
                current_profile_pic: post.current_profile_pic
            }));

        return res.json(result);

    } catch (err) {
        console.error("Error retrieving posts:", err);
        return res.status(500).json({ response: 'Database error.' });
    }
});

module.exports = router;
