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

router.get('/get_single_comment', async (req, res) => {
    const commentId = req.query.id;

    if (!commentId || isNaN(commentId)) {
        return res.status(400).json({ response: 'Invalid or missing comment ID.' });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
        return res.status(401).json({ response: 'Missing or invalid token.' });
    }

    const token = authHeader.split(" ")[1];
    const userId = await getIdByToken(token);

    if (!userId) {
        return res.status(401).json({ response: 'Invalid token.' });
    }

    try {
        const conn = await getConnection();

        const [[userRow]] = await conn.execute(
            "SELECT list_negative, list_negative_external FROM users WHERE id = ?",
            [userId]
        );

        const negativeList = tryParseJson(userRow?.list_negative) || [];
        const externalList = tryParseJson(userRow?.list_negative_external) || [];

        const [commentRows] = await conn.execute(
            `SELECT id, post_id, owner_id, content, media, comment_date,
                    list_vote_up, list_vote_down
             FROM comments
             WHERE id = ?`,
            [commentId]
        );

        if (commentRows.length === 0) {
            await conn.end();
            return res.status(404).json({ response: 'Comment not found.' });
        }

        const comment = commentRows[0];

        // Bloqueo por listas negativas
        if (negativeList.includes(comment.owner_id) || externalList.includes(comment.owner_id)) {
            await conn.end();
            return res.status(403).json({ response: 'Access to this comment is restricted.' });
        }

        // Verificar privacidad del post al que pertenece
        const [[postRow]] = await conn.execute(
            `SELECT owner_id, private_post FROM posts WHERE id = ?`,
            [comment.post_id]
        );

        if (!postRow) {
            await conn.end();
            return res.status(404).json({ response: 'Parent post not found.' });
        }

        if (postRow.private_post === 1 && postRow.owner_id !== userId) {
            await conn.end();
            return res.status(403).json({ response: 'Unauthorized access to private post comments.' });
        }

        await conn.end();

        return res.json({
            ...comment,
            media: tryParseJson(comment.media),
            list_vote_up: tryParseJson(comment.list_vote_up),
            list_vote_down: tryParseJson(comment.list_vote_down),
        });
    } catch (err) {
        console.error("Error retrieving comment:", err);
        return res.status(500).json({ response: 'Database error.' });
    }
});

module.exports = router;
