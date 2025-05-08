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

router.post('/update_pics', async (req, res) => {
    const { pic, url } = req.body;

    if (!pic || !url || !['profile', 'cover'].includes(pic)) {
        return res.status(400).json({ status: "error", message: "Invalid input." });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ status: "error", message: "Missing or invalid token." });
    }

    const token = authHeader.split(" ")[1];
    const userId = await getIdByToken(token);

    if (!userId) {
        return res.status(401).json({ status: "error", message: "Invalid token." });
    }

    const column = pic === "profile" ? "current_profile_pic" : "current_cover_pic";

    try {
        const conn = await getConnection();

        const [result] = await conn.execute(
            `UPDATE users SET ${column} = ? WHERE id = ?`,
            [url, userId]
        );

        await conn.end();

        return res.json({ status: "ok", message: "Picture updated." });
    } catch (error) {
        console.error("Error updating picture:", error);
        return res.status(500).json({ status: "error", message: "Database error." });
    }
});

module.exports = router;
