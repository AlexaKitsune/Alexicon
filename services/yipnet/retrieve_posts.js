const express = require('express');
const pool = require('../../utils/dbConn');
const getIdByToken = require('../../utils/getIdByToken');

const router = express.Router();

function tryParseJson(value) {
  if (typeof value === 'string')
    try { return JSON.parse(value); } catch { return value; }
  return value;
}

router.post('/retrieve_posts', async (req, res) => {
    const { ids } = req.body;

    if (!Array.isArray(ids))
        return res.status(400).json({ response: 'Invalid ids array.' });

    // Asegura números finitos
    const safeIds = ids.map(Number).filter(Number.isFinite);
    if (safeIds.length !== ids.length || safeIds.length === 0)
        return res.status(400).json({ response: 'Invalid ids array.' });

    // Auth opcional (para filtrar privados)
    let userId = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        userId = await getIdByToken(token); // puede ser null
    }

    try {
        const placeholders = safeIds.map(() => '?').join(',');

        const sql = `
        SELECT p.id, p.owner_id, p.content, p.media, p.shared_by_list, p.share_id,
            p.private_post, p.nsfw_post, p.comment_count, p.list_vote_heart,
            p.list_vote_up, p.list_vote_down, p.post_date, p.ai_generated,
            u.name, u.surname, u.current_profile_pic, u.services
        FROM posts p
        JOIN users u ON p.owner_id = u.id
        WHERE p.id IN (${placeholders})
        ORDER BY FIELD(p.id, ${placeholders})`;

        // usamos los IDs dos veces: IN(...) y FIELD(...)
        const params = [...safeIds, ...safeIds];
        const [rows] = await pool.execute(sql, params);

        // Filtrar posts privados si no es el owner (userId null => no dueño)
        const result = rows
        .filter(post => post.private_post !== 1 || post.owner_id === userId)
        .map(post => ({
            id: post.id,
            owner_id: post.owner_id,
            content: typeof post.content === 'string'
                ? post.content
                : (post.content ? Buffer.from(post.content).toString('utf8') : ''),
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
        }));

        return res.json(result);
    } catch (err) {
        console.error('Error retrieving posts:', err);
        return res.status(500).json({ response: 'Database error.' });
    }
});

module.exports = router;