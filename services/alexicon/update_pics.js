const express = require('express');
const pool = require('../../utils/dbConn');
const getIdByToken = require('../../utils/getIdByToken');
const router = express.Router();

router.post('/update_pics', async (req, res) => {
    const { pic, url } = req.body;

    if (!pic || !url || !['profile', 'cover'].includes(pic))
        return res.status(400).json({ status: "error", message: "Invalid input." });

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer "))
        return res.status(401).json({ status: "error", message: "Missing or invalid token." });

    const token = authHeader.split(" ")[1];
    const userId = await getIdByToken(token);

    if (!userId)
        return res.status(401).json({ status: "error", message: "Invalid token." });

    const column = pic === "profile" ? "current_profile_pic" : "current_cover_pic";

    try {
        const [result] = await pool.execute(
            `UPDATE users SET ${column} = ? WHERE id = ?`,
            [url, userId]
        );

        return res.json({ status: "ok", message: "Picture updated." });
    } catch (error) {
        console.error("Error updating picture:", error);
        return res.status(500).json({ status: "error", message: "Database error." });
    }
});

module.exports = router;
