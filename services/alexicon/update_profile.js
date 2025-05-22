const express = require('express');
const mysql = require('mysql2/promise');
const getIdByToken = require('../../utils/getIdByToken');
const router = express.Router();

// Validaciones:
function validateUsername(text) {
    return typeof text === "string" && text.length >= 2;
}

function validateGender(gender) {
    return /^[a-zA-Z]+$/.test(gender);
}

function validateAtSign(at_sign) {
    return typeof at_sign === "string" && /^[a-zA-Z0-9_]+$/.test(at_sign);
}

async function getConnection() {
    return await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASS,
        database: process.env.DB_NAME,
    });
}

router.post('/update_profile', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ status: 'error', message: 'Missing or invalid token.' });
    }

    const token = authHeader.split(' ')[1];
    const userId = await getIdByToken(token);
    if (!userId) {
        return res.status(401).json({ status: 'error', message: 'Invalid token.' });
    }

    const { name, surname, nickname, at_sign, gender, description } = req.body;

    // Validaciones:
    if (!validateUsername(name) || !validateUsername(surname) || !validateUsername(nickname)) {
        return res.status(400).json({ status: 'error', message: 'Name, surname and nickname must have at least 2 characters.' });
    }

    if (at_sign && !validateAtSign(at_sign)) {
        return res.status(400).json({ status: 'error', message: 'Invalid at_sign. Only letters, numbers and underscores are allowed.' });
    }

    if (!validateGender(gender)) {
        return res.status(400).json({ status: 'error', message: 'Invalid gender format.' });
    }

    try {
        const conn = await getConnection();

        // Comprobar que no haya otro usuario con el mismo nickname:
        const [nicknameRows] = await conn.execute(
            'SELECT id FROM users WHERE nickname = ? AND id != ?',
            [nickname, userId]
        );
        if (nicknameRows.length > 0) {
            await conn.end();
            return res.status(409).json({ status: 'error', message: 'Nickname already in use.' });
        }

        // Comprobar que no haya otro usuario con el mismo at_sign (si se proporciona):
        if (at_sign) {
            const [atSignRows] = await conn.execute(
                'SELECT id FROM users WHERE at_sign = ? AND id != ?',
                [at_sign, userId]
            );
            if (atSignRows.length > 0) {
                await conn.end();
                return res.status(409).json({ status: 'error', message: 'at_sign already in use.' });
            }
        }

        // Actualizar el perfil:
        await conn.execute(
            `UPDATE users SET name = ?, surname = ?, nickname = ?, at_sign = ?, gender = ?, description = ?
             WHERE id = ?`,
            [name, surname, nickname, at_sign, gender, description, userId]
        );

        await conn.end();

        return res.json({ status: 'ok', message: 'Profile updated successfully.' });
    } catch (error) {
        console.error('Error updating profile:', error);
        return res.status(500).json({ status: 'error', message: 'Server error.' });
    }
});

module.exports = router;
