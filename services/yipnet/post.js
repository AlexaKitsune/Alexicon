const express = require('express');
const pool = require('../../utils/dbConn'); // usa pool
const getIdByToken = require('../../utils/getIdByToken');
const { emitNotification } = require('../../utils/socket');
const router = express.Router();

router.post('/post', async (req, res) => {
    const { content, media, shareId, privatePost, nsfwPost, aiGenerated } = req.body;

    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer '))
        return res.status(401).json({ response: 'Missing or invalid token.' });

    const token = authHeader.split(' ')[1];
    const ownerId = await getIdByToken(token);
    if (!ownerId)
        return res.status(403).json({ response: 'Unauthorized user.' });

    if (content === undefined || privatePost === undefined || nsfwPost === undefined)
        return res.status(400).json({ response: 'Missing required fields.' });

    const mediaJSON = Array.isArray(media) ? JSON.stringify(media) : (typeof media === 'string' ? media : '[]');
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;
    const sid = Number(shareId);

    let conn;
    try {
        conn = await pool.getConnection();
        await conn.beginTransaction();

        // 1) Crear post
        const [result] = await conn.execute(`
            INSERT INTO posts (owner_id, content, media, share_id, private_post, nsfw_post, ai_generated, origin) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [ownerId, content, mediaJSON, sid || 0, !!privatePost, !!nsfwPost, !!aiGenerated, ip]
        );
        const newPostId = result.insertId;

        // 2) Si es share de otro post
        if (Number.isFinite(sid) && sid > 0) {
            const [rows] = await conn.execute(
                `SELECT owner_id, shared_by_list FROM posts WHERE id = ? LIMIT 1`,
                [sid]
            );

            if (rows.length) {
                const originalOwnerId = rows[0].owner_id;

                // Evita auto-notificación
                if (originalOwnerId !== ownerId) {
                    // Actualiza shared_by_list
                    let sharedByList = [];
                    try { sharedByList = JSON.parse(rows[0].shared_by_list || '[]'); } catch { /* noop */ }
                    if (!sharedByList.includes(newPostId)) {
                        sharedByList.push(newPostId);
                        await conn.execute(
                            `UPDATE posts SET shared_by_list = ? WHERE id = ?`,
                            [JSON.stringify(sharedByList), sid]
                        );
                    }

                    // Datos del usuario que compartió
                    const [userDataResult] = await conn.execute(
                        `SELECT id, name, surname, current_profile_pic, services
                        FROM users WHERE id = ? LIMIT 1`,
                        [ownerId]
                    );
                    const userData = userDataResult[0];

                    // Notificación persistente
                    await emitNotification(originalOwnerId, 'post_shared', 'yipnet', {
                        message: 'You have a new notification',
                        user: userData,
                        sharedPostId: newPostId
                    }, true);
                }
            }
        }

        await conn.commit();

        return res.json({ response: 'Post created successfully.', post_id: newPostId });
    } catch (error) {
        if (conn) await conn.rollback();
        console.error('Error creating post:', error);
        return res.status(500).json({ response: 'Database error.' });
    } finally {
        if (conn) conn.release();
    }
});

module.exports = router;
