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

router.post('/post', async (req, res) => {
    const {
        content,
        media,
        shareId,
        privatePost,
        nsfwPost
    } = req.body;

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ response: 'Missing or invalid token.' });
    }

    const token = authHeader.split(" ")[1];
    const ownerId = await getIdByToken(token);
    if (!ownerId) {
        return res.status(403).json({ response: 'Unauthorized user.' });
    }

    if (content === undefined || privatePost === undefined || nsfwPost === undefined) {
        return res.status(400).json({ response: 'Missing required fields.' });
    }

    const mediaJSON = typeof media === 'string' ? media : JSON.stringify(media);

	const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;

    try {
        const conn = await getConnection();
        const [result] = await conn.execute(`
            INSERT INTO posts (
                owner_id, content, media, share_id,
                private_post, nsfw_post, origin
            ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [ownerId, content, mediaJSON, shareId, privatePost, nsfwPost, ip]
        );
        await conn.end();

        return res.json({
            response: 'Post created successfully.',
            post_id: result.insertId
        });
    } catch (error) {
        console.error('Error creating post:', error);
        return res.status(500).json({ response: 'Database error.' });
    }
});

module.exports = router;
