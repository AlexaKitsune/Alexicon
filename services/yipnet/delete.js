const express = require('express');
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const getIdByToken = require('../../utils/getIdByToken');
const router = express.Router();

const STORAGE_ROOT = path.join(__dirname, '../../storage');

async function getConnection() {
    return await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASS,
        database: process.env.DB_NAME,
    });
}

router.post('/delete', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ status: 'error', message: 'Token requerido.' });
    }

    const token = authHeader.split(' ')[1];
    const userId = await getIdByToken(token);
    if (!userId) {
        return res.status(401).json({ status: 'error', message: 'Token inválido.' });
    }

    const { id, type } = req.body;
    if (!id || !['post', 'comment'].includes(type)) {
        return res.status(400).json({ status: 'error', message: 'Parámetros inválidos.' });
    }

    const conn = await getConnection();

    try {
        if (type === 'post') {
            // Verificar post y obtener media
            const [postRows] = await conn.execute('SELECT media FROM posts WHERE id = ? AND owner_id = ?', [id, userId]);
            if (postRows.length === 0) return res.status(403).json({ status: 'error', message: 'No tienes permiso o el post no existe.' });

            const postMedia = JSON.parse(postRows[0].media || '[]');
            postMedia.forEach(relative => deleteFile(relative));

            // Obtener comentarios y sus archivos
            const [commentRows] = await conn.execute('SELECT media FROM comments WHERE post_id = ?', [id]);
            commentRows.forEach(row => {
                const commentMedia = JSON.parse(row.media || '[]');
                commentMedia.forEach(relative => deleteFile(relative));
            });

            // Eliminar comentarios y luego post
            await conn.execute('DELETE FROM comments WHERE post_id = ?', [id]);
            await conn.execute('DELETE FROM posts WHERE id = ? AND owner_id = ?', [id, userId]);

        } else if (type === 'comment') {
            const [commentRows] = await conn.execute('SELECT media FROM comments WHERE id = ? AND owner_id = ?', [id, userId]);
            if (commentRows.length === 0) return res.status(403).json({ status: 'error', message: 'No tienes permiso o el comentario no existe.' });

            const commentMedia = JSON.parse(commentRows[0].media || '[]');
            commentMedia.forEach(relative => deleteFile(relative));

            await conn.execute('DELETE FROM comments WHERE id = ? AND owner_id = ?', [id, userId]);
        }

        await conn.end();
        return res.json({ status: 'ok' });

    } catch (err) {
        console.error("Error en eliminación:", err);
        if (conn) await conn.end();
        return res.status(500).json({ status: 'error', message: 'Error del servidor.' });
    }
});

function deleteFile(relativePath) {
    const fullPath = path.join(STORAGE_ROOT, relativePath);
    if (fs.existsSync(fullPath)) {
        try {
            fs.unlinkSync(fullPath);
        } catch (err) {
            console.warn(`No se pudo eliminar archivo ${relativePath}:`, err.message);
        }
    }
}

module.exports = router;
