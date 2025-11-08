// services/alexicon/session.js
const express = require('express');
const jwt = require('jsonwebtoken');
const pool = require('../../utils/dbConn');
require('dotenv').config();

const router = express.Router();

/**
 * GET /alexicon/session
 * Header: Authorization: Bearer <token>
 * Respuestas:
 *  - 200 { status:"ok", user_id, exp, now }
 *  - 401 { status:"error", message:"Invalid or expired token." }
 */
router.get('/check_session', async (req, res) => {
    try {
        const authHeader = req.headers.authorization || '';
        if (!authHeader.startsWith('Bearer '))
            return res.status(401).json({ status: 'error', message: 'Missing or invalid token.' });

        const token = authHeader.split(' ')[1];

        // 1) Verificar firma/exp del JWT
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET_KEY); // lanza si expiró o firma inválida
        } catch {
            return res.status(401).json({ status: 'error', message: 'Invalid or expired token.' });
        }

        const userId = Number(decoded.sub);
        const jti = decoded.jti;
        if (!Number.isFinite(userId) || !jti)
            return res.status(401).json({ status: 'error', message: 'Invalid token payload.' });

        // 2) Verificar que el jti siga activo en base de datos
        const [rows] = await pool.execute(
            'SELECT 1 FROM active_tokens WHERE jti = ? AND user_id = ? LIMIT 1',
            [jti, userId]
        );
        if (!rows.length)
            return res.status(401).json({ status: 'error', message: 'Session revoked.' });

        // 3) OK
        return res.json({
            status: 'ok',
            user_id: userId,
            exp: decoded.exp,                   // seg UNIX
            now: Math.floor(Date.now() / 1000), // seg UNIX
        });
    } catch (err) {
        console.error('session check error:', err);
        return res.status(500).json({ status: 'error', message: 'Server error.' });
    }
});

module.exports = router;
