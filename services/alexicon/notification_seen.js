const express = require('express');
const pool = require('../../utils/dbConn');
const getIdByToken = require('../../utils/getIdByToken');

const router = express.Router();

router.post('/notification_seen', async (req, res) => {
	// Auth
	const authHeader = req.headers.authorization;
	if (!authHeader || !authHeader.startsWith('Bearer '))
		return res.status(401).json({ status: "error", message: "Missing or invalid token." });

	const token = authHeader.split(" ")[1];
	const userId = await getIdByToken(token);
	if (!userId)
		return res.status(401).json({ status: "error", message: "Invalid token." });

	const { id, mode } = req.body;

	try {
		if (mode === 'all') {
			await pool.execute(
				"UPDATE notifications SET seen = 1 WHERE owner_id = ?",
				[userId]
			);
			return res.json({ status: "ok", message: "All notifications marked as seen." });
		}

		// Caso individual
		const nid = Number(id);
		if (!Number.isFinite(nid))
			return res.status(400).json({ status: "error", message: "Invalid or missing notification ID." });

		const [result] = await pool.execute(
			"UPDATE notifications SET seen = 1 WHERE id = ? AND owner_id = ?",
			[nid, userId]
		);

		if (result.affectedRows === 0)
			return res.status(404).json({ status: "error", message: "Notification not found or unauthorized." });

		return res.json({ status: "ok", message: "Notification marked as seen." });

	} catch (error) {
		console.error("Error in notification_seen endpoint:", error);
		return res.status(500).json({ status: "error", message: "Database error." });
	}
});

module.exports = router;