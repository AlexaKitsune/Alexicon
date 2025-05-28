const express = require('express');
const mysql = require('mysql2/promise');
const router = express.Router();

async function getConnection() {
    return await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASS,
        database: process.env.DB_NAME,
    });
}

router.post('/logout', async (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ response: 'Missing token.' });

    try {
        const conn = await getConnection();
        await conn.execute('DELETE FROM active_tokens WHERE token = ?', [token]);
        await conn.end();

        return res.json({ response: 'Logged out successfully.' });
    } catch (err) {
        console.error("Logout error:", err);
        return res.status(500).json({ response: 'Server error.' });
    }
});

module.exports = router;
