const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');
const { retrieveUserData } = require('../../utils/retrieveUserData');
require('dotenv').config();

const router = express.Router();

async function getConnection() {
    return await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASS,
        database: process.env.DB_NAME,
    });
}

router.post('/login', async (req, res) => {
    const data = req.body;

    if (!data.access_word || !data.password) {
        return res.json({ response: "Empty email or password." });
    }

    try {
        const conn = await getConnection();
        const [rows] = await conn.execute(
            "SELECT * FROM users WHERE email = ? OR at_sign = ?",
            [data.access_word, data.access_word]
        );

        if (rows.length === 0) {
            await conn.end();
            return res.json({ response: "User does not exist." });
        }

        const user = rows[0];
        const passwordMatches = await bcrypt.compare(data.password, user.password);

        if (!passwordMatches) {
            await conn.end();
            return res.json({ response: "Incorrect email or password." });
        }

        const token = jwt.sign({ identity: user.email }, process.env.JWT_SECRET_KEY, {
            expiresIn: 24 * 60 * 60 // 24 horas
        });

        // Obtener datos públicos del usuario usando la función reutilizable
        const user_data = await retrieveUserData(user.id);

        await conn.end();

        return res.json({
            response: "Correct login.",
            user_data,
            access_token: token
        });

    } catch (err) {
        console.error("Database error:", err);
        return res.status(500).json({ response: "Database error." });
    }
});

module.exports = router;
