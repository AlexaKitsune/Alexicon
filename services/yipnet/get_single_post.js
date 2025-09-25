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

router.get('/get_single_post', async (req, res) => {
    const postId = req.query.id;

    if (!postId || isNaN(postId)) {
        return res.status(400).json({ response: 'Invalid or missing post ID.' });
    }

    let userId = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.split(" ")[1];
        userId = await getIdByToken(token);
    }

    try {
        const conn = await getConnection();
        const [rows] = await conn.execute(
            `SELECT p.id, p.owner_id, p.content, p.media, p.shared_by_list, p.share_id,
                    p.private_post, p.nsfw_post, p.comment_count, p.list_vote_heart,
                    p.list_vote_up, p.list_vote_down, p.post_date, p.ai_generated,
                    u.name, u.surname, u.current_profile_pic, u.services
             FROM posts p
             JOIN users u ON p.owner_id = u.id
             WHERE p.id = ?`,
            [postId]
        );
        await conn.end();

        if (rows.length === 0) {
            return res.status(404).json({ response: 'Post not found.' });
        }

        const post = rows[0];

        if (post.private_post === 1 && post.owner_id !== userId) {
            return res.status(403).json({ response: 'Unauthorized access to private post.' });
        }

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

        return res.json({
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
            current_profile_pic: post.current_profile_pic,
            ai_generated: post.ai_generated,
        });
    } catch (err) {
        console.error("Error retrieving post:", err);
        return res.status(500).json({ response: 'Database error.' });
    }
});

module.exports = router;
