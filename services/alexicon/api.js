const express = require('express');
const pool = require('../../utils/dbConn');
const crypto = require('crypto');
const getIdByToken = require('../../utils/getIdByToken');

const router = express.Router();

function generateApiKey() {
    return crypto.randomBytes(32).toString('hex'); // 64 chars
}

router.post('/api', async (req, res) => {
    const { mode } = req.body;
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer "))
        return res.status(401).json({ status: "error", message: "Missing or invalid token." });

    const token = authHeader.split(" ")[1];
    const userId = await getIdByToken(token);

    if (!userId)
        return res.status(401).json({ status: "error", message: "Invalid token." });

    if (!["generate", "revoke", "get"].includes(mode))
        return res.status(400).json({ status: "error", message: "Invalid mode." });

    let conn;
    try {
        if (mode === "get") {
            // Solo lectura: no necesitas transacción ni getConnection
            const [rows] = await pool.execute("SELECT api_code FROM users WHERE id = ?", [userId]);
            if (rows.length === 0)
                return res.status(404).json({ status: "error", message: "User not found." });
            return res.json({ status: "ok", api_code: rows[0].api_code || null });
        }

        // generate / revoke → escritura: usa conexión y transacción
        conn = await pool.getConnection();
        await conn.beginTransaction();

        if (mode === "generate") {
            let apiKey;
            let exists = true;
            let attemptCount = 0;

            while (exists && attemptCount < 5) {
                apiKey = generateApiKey();
                const [rows] = await conn.execute(
                    "SELECT id FROM users WHERE api_code = ?",
                    [apiKey]
                );
                exists = rows.length > 0;
                attemptCount++;
            }
            if (exists) {
                await conn.rollback();
                return res.status(500).json({ status: "error", message: "Failed to generate unique API key." });
            }

            await conn.execute("UPDATE users SET api_code = ? WHERE id = ?", [apiKey, userId]);
            await conn.commit();
            return res.json({ status: "ok", api_code: apiKey });
        }

        if (mode === "revoke") {
            await conn.execute("UPDATE users SET api_code = NULL WHERE id = ?", [userId]);
            await conn.commit();
            return res.json({ status: "ok", message: "API key revoked." });
        }

    } catch (err) {
        console.error("Database error:", err);
        try { if (conn) await conn.rollback(); } catch {}
        return res.status(500).json({ status: "error", message: "Database connection error." });
    } finally {
        if (conn) conn.release();
    }
});

module.exports = router;
