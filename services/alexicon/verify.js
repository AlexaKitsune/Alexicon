// services/alexicon/verify.js
const express = require('express');
const pool = require('../../utils/dbConn');

const router = express.Router();

/**
 * GET /alexicon/verify?id=123&verify_key=abcdef
 */
router.get('/verify', async (req, res) => {
    const { id, verify_key } = req.query;

    const uid = Number(id);
    if (!Number.isFinite(uid) || !verify_key || typeof verify_key !== 'string')
        return res.status(400).json({ status: 'error', message: 'Parámetros inválidos.' });

    try {
        // Opción recomendada: también limpiar verify_key para evitar reuso
        const [result] = await pool.execute(
            'UPDATE users SET verified = 1, verify_key = NULL WHERE id = ? AND verify_key = ?',
            [uid, verify_key]
        );

        if (result.affectedRows === 0)
            return res.status(400).json({ status: 'error', message: 'Link inválido o ya verificado.' });

        return res.json({ status: 'ok', message: 'Correo verificado correctamente.' });
    } catch (err) {
        console.error('[verify] Error:', err);
        return res.status(500).json({ status: 'error', message: 'Error del servidor.' });
    }
});

module.exports = router;