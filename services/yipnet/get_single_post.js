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

    if (!postId) {
        return res.status(400).json({ response: 'Missing post ID.' });
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
            `SELECT id, owner_id, content, media, shared_by_list, share_id,
                    private_post, nsfw_post, comment_count, list_vote_heart,
                    list_vote_up, list_vote_down, post_date
             FROM posts
             WHERE id = ?`,
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

        return res.json(post);
    } catch (err) {
        console.error("Error retrieving post:", err);
        return res.status(500).json({ response: 'Database error.' });
    }
});

module.exports = router;
