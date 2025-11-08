const express = require('express');
const bcrypt = require('bcrypt');
const pool = require('../../utils/dbConn');
const getIdByToken = require('../../utils/getIdByToken');

const router = express.Router();

function isValidPassword(password) {
    const regex = /^(?=.*[0-9])(?=.*[a-z])(?=.*[A-Z])(?=.*\W)(?!.* ).{8,128}$/;
    return regex.test(password);
}

router.post('/update_pass', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer '))
        return res.status(401).json({ status: 'error', message: 'Missing or invalid token.' });

    const token = authHeader.split(' ')[1];
    const userId = await getIdByToken(token);
    if (!userId)
        return res.status(401).json({ status: 'error', message: 'Invalid token.' });

    const { oldPass, newPass } = req.body;

    if (!oldPass || !newPass)
        return res.status(400).json({ status: 'error', message: 'Missing required fields.' });

    if (!isValidPassword(newPass))
        return res.status(400).json({ status: 'error', message: 'New password does not meet requirements.' });

    try {
        // 1) Obtener hash actual
        const [rows] = await pool.execute('SELECT password FROM users WHERE id = ?', [userId]);
        if (rows.length === 0)
            return res.status(404).json({ status: 'error', message: 'User not found.' });

        // 2) Comparar contraseña anterior
        const passwordMatch = await bcrypt.compare(oldPass, rows[0].password);
        if (!passwordMatch)
            return res.status(403).json({ status: 'error', message: 'Old password is incorrect.' });

        // 3) Actualizar a nuevo hash
        const hashedNewPass = await bcrypt.hash(newPass, 10);
        await pool.execute('UPDATE users SET password = ? WHERE id = ?', [hashedNewPass, userId]);

        return res.json({ status: 'ok', message: 'Password updated successfully.' });
    } catch (error) {
        console.error('Error updating password:', error);
        return res.status(500).json({ status: 'error', message: 'Server error.' });
    }
});

module.exports = router;