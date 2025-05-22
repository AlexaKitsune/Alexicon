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

router.get('/newsfeed', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ response: 'Missing or invalid token.' });
    }

    const token = authHeader.split(" ")[1];
    const myId = await getIdByToken(token);
    if (!myId) {
        return res.status(403).json({ response: 'Unauthorized user.' });
    }

    try {
        const conn = await getConnection();

        // Obtener list_positive del usuario actual
        const [rows] = await conn.execute("SELECT list_positive FROM users WHERE id = ?", [myId]);
        if (rows.length === 0) {
            await conn.end();
            return res.status(404).json({ response: 'User not found.' });
        }

        let positiveList = JSON.parse(rows[0].list_positive || '[]');

        if (!positiveList.includes(myId)) {
            positiveList.push(myId);
        }

        if (positiveList.length === 0) {
            await conn.end();
            return res.json({ response: { post_list: [] } });
        }

        const placeholders = positiveList.map(() => '?').join(',');
        const [posts] = await conn.execute(
            `SELECT p.*, u.name, u.surname, u.current_profile_pic, u.services
             FROM posts p
             JOIN users u ON p.owner_id = u.id
             WHERE p.owner_id IN (${placeholders})
             ORDER BY p.post_date DESC`,
            positiveList
        );

        const sanitizedPosts = posts.map(post => ({
            ...post,
            content: typeof post.content === 'string' ? post.content : Buffer.from(post.content).toString('utf8'),
            media: JSON.parse(post.media || '[]'),
            shared_by_list: JSON.parse(post.shared_by_list || '[]'),
            list_vote_heart: JSON.parse(post.list_vote_heart || '[]'),
            list_vote_up: JSON.parse(post.list_vote_up || '[]'),
            list_vote_down: JSON.parse(post.list_vote_down || '[]'),
            services: JSON.parse(post.services || '{}'),
            post_date: post.post_date instanceof Date ? post.post_date.toISOString() : post.post_date
        }));

        await conn.end();
        return res.json({ response: sanitizedPosts });

    } catch (error) {
        console.error('Error fetching news feed:', error);
        return res.status(500).json({ response: 'Database error.' });
    }
});

module.exports = router;
