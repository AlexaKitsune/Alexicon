const express = require('express');
const pool = require('../../utils/dbConn');
const getIdByToken = require('../../utils/getIdByToken');

const router = express.Router();

function tryParseJson(value, fallback) {
    if (value == null) return fallback;
    if (typeof value === 'string')
        try { return JSON.parse(value); } catch { return fallback; }
    return value ?? fallback;
}

router.get('/newsfeed', async (req, res) => {
    // Auth
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer "))
        return res.status(401).json({ response: 'Missing or invalid token.' });
    const token = authHeader.split(" ")[1];
    const myId = await getIdByToken(token);
    if (!myId)
        return res.status(403).json({ response: 'Unauthorized user.' });

    try {
        // list_positive del usuario actual
        const [[row]] = await pool.execute(
            "SELECT list_positive FROM users WHERE id = ?",
            [myId]
        );
        if (!row)
            return res.status(404).json({ response: 'User not found.' });

        let positiveList = tryParseJson(row.list_positive, []);
        if (!Array.isArray(positiveList)) positiveList = [];

        // incluir al propio usuario
        if (!positiveList.includes(myId)) positiveList.push(myId);

        if (positiveList.length === 0)
            return res.json({ response: [] });

        const placeholders = positiveList.map(() => '?').join(',');
        const [posts] = await pool.execute(
            `SELECT p.*, u.name, u.surname, u.current_profile_pic, u.services
                FROM posts p
                JOIN users u ON p.owner_id = u.id
            WHERE p.owner_id IN (${placeholders})
            ORDER BY p.post_date DESC`,
            positiveList
        );

        const sanitizedPosts = posts.map(post => ({
            ...post,
            // content puede llegar como Buffer en algunos drivers/configs
            content:
                typeof post.content === 'string'
                ? post.content
                : (post.content ? Buffer.from(post.content).toString('utf8') : ''),
            media: tryParseJson(post.media, []),
            shared_by_list: tryParseJson(post.shared_by_list, []),
            list_vote_heart: tryParseJson(post.list_vote_heart, []),
            list_vote_up: tryParseJson(post.list_vote_up, []),
            list_vote_down: tryParseJson(post.list_vote_down, []),
            services: tryParseJson(post.services, {}),

            post_date: post.post_date instanceof Date
                ? post.post_date.toISOString()
                : post.post_date
        }));

        return res.json({ response: sanitizedPosts });
    } catch (error) {
        console.error('Error fetching news feed:', error);
        return res.status(500).json({ response: 'Database error.' });
    }
});

module.exports = router;