const express = require('express');
const mysql = require('mysql2/promise');
const getIdByToken = require('../../utils/getIdByToken');
const { emitToUser } = require('../../utils/socket');
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

        // Crear el nuevo post
        const [result] = await conn.execute(`
            INSERT INTO posts (
                owner_id, content, media, share_id,
                private_post, nsfw_post, origin
            ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [ownerId, content, mediaJSON, shareId, privatePost, nsfwPost, ip]
        );

        const newPostId = result.insertId;

        // Si es un share de otro post
        if (shareId > 0) {
            // Obtener el owner_id y shared_by_list del post original
            const [rows] = await conn.execute(`
                SELECT owner_id, shared_by_list FROM posts WHERE id = ?`, [shareId]);

            if (rows.length > 0) {
                const originalOwnerId = rows[0].owner_id;
                let sharedByList = [];

                try {
                    sharedByList = JSON.parse(rows[0].shared_by_list || '[]');
                } catch (e) {
                    console.error('Error parsing shared_by_list:', e);
                }

                // Agregar nuevo ID a shared_by_list
                if (!sharedByList.includes(newPostId)) {
                    sharedByList.push(newPostId);

                    await conn.execute(`
                        UPDATE posts SET shared_by_list = ? WHERE id = ?`,
                        [JSON.stringify(sharedByList), shareId]
                    );
                }

                // Obtener datos del usuario que compartió
                const [userDataResult] = await conn.execute(`
                    SELECT id, name, surname, current_profile_pic, services
                    FROM users WHERE id = ?`, [ownerId]);

                const userData = userDataResult[0];

                // Construir contenido de notificación
                const notificationContent = {
                    user: userData,
                    sharedPostId: newPostId
                };

                // Insertar notificación
                await conn.execute(`
                    INSERT INTO notifications (owner_id, content, service)
                    VALUES (?, ?, ?)`,
                    [originalOwnerId, JSON.stringify(notificationContent), 'yipnet']
                );

                // Enviar alerta simple por socket
                emitToUser(originalOwnerId, 'yipnet_notification', {
                    message: 'You have a new notification',
                    timestamp: new Date().toISOString()
                });
            }
        }

        await conn.end();

        return res.json({
            response: 'Post created successfully.',
            post_id: newPostId
        });

    } catch (error) {
        console.error('Error creating post:', error);
        return res.status(500).json({ response: 'Database error.' });
    }
});

module.exports = router;
