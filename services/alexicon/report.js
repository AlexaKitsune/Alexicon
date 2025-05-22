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

router.post('/report', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ status: 'error', message: 'Missing or invalid token.' });
    }

    const token = authHeader.split(' ')[1];
    const userId = await getIdByToken(token);
    if (!userId) {
        return res.status(401).json({ status: 'error', message: 'Invalid token.' });
    }

    const { service, type, route, message } = req.body;

    if (!service || !type || !route || !message) {
        return res.status(400).json({ status: 'error', message: 'Faltan campos requeridos' });
    }

    try {
        const conn = await getConnection();
        const origin = req.headers['origin'] || null;

        await conn.execute(`
            INSERT INTO reports (author, service, type, route, message, origin)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [userId, service, type, route, message, origin]);

        await conn.end();

        return res.json({ status: 'ok', message: 'Reporte guardado exitosamente' });
    } catch (err) {
        console.error('Error al guardar el reporte:', err);
        return res.status(500).json({ status: 'error', message: 'Error interno del servidor' });
    }
});

module.exports = router;
