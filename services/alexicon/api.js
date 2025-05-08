const express = require('express');
const mysql = require('mysql2/promise');
const crypto = require('crypto');
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

function generateApiKey() {
    return crypto.randomBytes(32).toString('hex'); // 64 caracteres hexadecimales
}

router.post('/api', async (req, res) => {
    const { mode } = req.body;
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ status: "error", message: "Missing or invalid token." });
    }

    const token = authHeader.split(" ")[1];
    const userId = await getIdByToken(token);

    if (!userId) {
        return res.status(401).json({ status: "error", message: "Invalid token." });
    }

    if (!["generate", "revoke", "get"].includes(mode)) {
        return res.status(400).json({ status: "error", message: "Invalid mode." });
    }

    try {
        const conn = await getConnection();

        if (mode === "generate") {
            let apiKey;
            let exists = true;
            let attemptCount = 0;

            // Asegurar que no se genere una clave duplicada (máximo 5 intentos)
            while (exists && attemptCount < 5) {
                apiKey = generateApiKey();
                const [rows] = await conn.execute("SELECT id FROM users WHERE api_code = ?", [apiKey]);
                exists = rows.length > 0;
                attemptCount++;
            }

            if (exists) {
                await conn.end();
                return res.status(500).json({ status: "error", message: "Failed to generate unique API key." });
            }

            await conn.execute("UPDATE users SET api_code = ? WHERE id = ?", [apiKey, userId]);
            await conn.end();
            return res.json({ status: "ok", api_code: apiKey });

        } else if (mode === "revoke") {
            await conn.execute("UPDATE users SET api_code = NULL WHERE id = ?", [userId]);
            await conn.end();
            return res.json({ status: "ok", message: "API key revoked." });

        } else if (mode === "get") {
            const [rows] = await conn.execute("SELECT api_code FROM users WHERE id = ?", [userId]);
            await conn.end();

            if (rows.length === 0) {
                return res.status(404).json({ status: "error", message: "User not found." });
            }

            return res.json({ status: "ok", api_code: rows[0].api_code || null });
        }
    } catch (err) {
        console.error("Database error:", err);
        return res.status(500).json({ status: "error", message: "Database connection error." });
    }
});

module.exports = router;
