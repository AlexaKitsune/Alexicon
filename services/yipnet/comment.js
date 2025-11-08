const express = require('express');
const pool = require('../../utils/dbConn');
const getIdByToken = require('../../utils/getIdByToken');
const { emitNotification } = require('../../utils/socket');

const router = express.Router();

router.post('/comment', async (req, res) => {
    // Auth
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer '))
        return res.status(401).json({ status: "error", message: "Missing or invalid token." });

    const token = authHeader.split(" ")[1];
    const userId = await getIdByToken(token);
    if (!userId)
        return res.status(401).json({ status: "error", message: "Invalid token." });

    const { mode, id, postId, content, media, aiGenerated } = req.body;

    try {
        if (mode === 'delete') {
            const cid = Number(id);
            if (!Number.isFinite(cid))
                return res.status(400).json({ status: "error", message: "Invalid or missing comment ID." });

            // Delete atómico (solo si es dueño)
            const [result] = await pool.execute(
                "DELETE FROM comments WHERE id = ? AND owner_id = ?",
                [cid, userId]
            );

            if (result.affectedRows === 0)
                return res.status(404).json({ status: "error", message: "Comment not found or not owned by user." });

            return res.json({ status: "ok", message: "Comment deleted successfully." });
        }

        // Crear comentario
        const pid = Number(postId);
        if (!Number.isFinite(pid))
            return res.status(400).json({ status: "error", message: "Invalid or missing postId." });
        if (typeof content !== 'string')
            return res.status(400).json({ status: "error", message: "Invalid content." });
        if (!Array.isArray(media))
            return res.status(400).json({ status: "error", message: "Media must be an array." });
        const aiFlag = aiGenerated ? 1 : 0;

        // Dueño del post
        const [postRows] = await pool.execute(
            "SELECT owner_id FROM posts WHERE id = ?",
            [pid]
        );
        const postOwnerId = postRows[0]?.owner_id;
        if (!postOwnerId)
            return res.status(404).json({ status: "error", message: "Target post not found." });

        // Insertar comentario
        const [insertRes] = await pool.execute(
            `INSERT INTO comments (post_id, owner_id, content, media, ai_generated) VALUES (?, ?, ?, ?, ?)`,
            [pid, userId, content, JSON.stringify(media), aiFlag]
        );
        const commentId = insertRes.insertId;

        // Notificar (fuera de la ruta crítica)
        if (postOwnerId !== userId) {
            try {
                const [userRows] = await pool.execute(
                    `SELECT id, name, surname, current_profile_pic, services FROM users WHERE id = ?`,
                    [userId]
                );
                const userData = userRows[0] || null;

                await emitNotification(postOwnerId, 'comment', 'yipnet', {
                    message: 'You have a new comment',
                    user: userData,
                    postId: pid,
                    commentId,
                    timestamp: new Date().toISOString(),
                });
            } catch (notifyErr) {
                console.error('emitNotification error (comment):', notifyErr);
                // No rompemos la respuesta si falla la notificación
            }
        }

        return res.json({ status: "ok", comment_id: commentId });

    } catch (error) {
        console.error("Error in comment endpoint:", error);
        return res.status(500).json({ status: "error", message: "Database error." });
    }
});

module.exports = router;