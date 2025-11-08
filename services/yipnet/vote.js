const express = require("express");
const pool = require('../../utils/dbConn');
const getIdByToken = require("../../utils/getIdByToken");
const { emitNotification } = require('../../utils/socket');

const router = express.Router();

router.post("/vote", async (req, res) => {
	const { voteType, targetId, entityType } = req.body;

	// Auth
	const authHeader = req.headers.authorization;
	if (!authHeader || !authHeader.startsWith("Bearer "))
		return res.status(401).json({ response: "Missing or invalid token." });

	const token = authHeader.split(" ")[1];
	const myId = await getIdByToken(token);
	if (!myId) return res.status(403).json({ response: "Unauthorized user." });

	// Validación de campos
	if (!voteType || targetId == null || !entityType)
		return res.status(400).json({ response: "Missing required fields." });

	if (!["heart", "up", "down"].includes(voteType))
		return res.status(400).json({ response: "Invalid voteType." });

	if (!["post", "comment", "message"].includes(entityType))
		return res.status(400).json({ response: "Invalid entityType." });

	const TABLES  = { post: 'posts', comment: 'comments', message: 'messages' };
	const COLUMNS = { heart: 'list_vote_heart', up: 'list_vote_up', down: 'list_vote_down' };
	const table  = TABLES[entityType];
	const column = COLUMNS[voteType];
	if (!table || !column) return res.status(400).json({ response: "Invalid voteType or entityType." });

	const tid = Number(targetId);
	const uid = Number(myId);
	if (!Number.isFinite(tid) || !Number.isFinite(uid))
		return res.status(400).json({ response: "Invalid IDs." });

	let conn;
	try {
		conn = await pool.getConnection();
		await conn.beginTransaction();

		// Leer lista con bloqueo
			const [rows] = await conn.execute(
			`SELECT \`${column}\` FROM \`${table}\` WHERE id = ? FOR UPDATE`,
			[tid]
		);
		if (rows.length === 0) {
			await conn.rollback();
			return res.status(404).json({ response: "Target not found." });
		}

		// Parsear y togglear
		let list = [];
		try {
			const raw = JSON.parse(rows[0][column] || "[]");
			list = Array.isArray(raw) ? raw.map(Number).filter(Number.isFinite) : [];
		} catch { list = []; }

		const alreadyVoted = list.includes(uid);
		const newList = alreadyVoted ? list.filter(id => id !== uid) : [...list, uid];

		// Guardar
		await conn.execute(
			`UPDATE \`${table}\` SET \`${column}\` = ? WHERE id = ?`,
			[JSON.stringify(newList), tid]
		);

		// Obtener dueño/participantes
		let targetOwnerId = null;
		let senderId = null;
		let receiverId = null;

		if (entityType === "message") {
			const [msgRows] = await conn.execute(
				"SELECT sender_id, receiver_id FROM messages WHERE id = ?",
				[tid]
			);
			if (!msgRows.length) {
				await conn.rollback();
				return res.status(404).json({ response: "Message not found." });
			}
			senderId = msgRows[0]?.sender_id ?? null;
			receiverId = msgRows[0]?.receiver_id ?? null;
			targetOwnerId = senderId;
		} else {
			const [tRows] = await conn.execute(
				`SELECT owner_id FROM \`${table}\` WHERE id = ?`,
				[tid]
			);
			targetOwnerId = tRows[0]?.owner_id ?? null;
		}

		// Commit antes de notificar
		await conn.commit();

		// Notificar fuera de la TX
		const [userDataResult] = await pool.execute(
			"SELECT id, name, surname, current_profile_pic, services FROM users WHERE id = ?",
			[uid]
		);
		const userData = userDataResult[0];
		const payload = {
			user: userData,
			targetId: tid,
			voteType,
			entityType,
			status: alreadyVoted ? "removed" : "added",
			timestamp: new Date().toISOString(),
		};

		if (entityType === "message") {
			// Notificar a ambas partes excepto al actor
			const targets = new Set([senderId, receiverId]);
			for (const t of targets)
				if (Number.isFinite(t) && Number(t) !== uid)
					await emitNotification(t, 'vote', 'yipnet', payload);
		} else {
			// Posts/Comments: solo al owner si no es el actor
			if (Number.isFinite(targetOwnerId) && Number(targetOwnerId) !== uid)
				await emitNotification(targetOwnerId, 'vote', 'yipnet', payload);
		}

		return res.json({ response: "Vote updated", status: alreadyVoted ? "removed" : "added" });

	} catch (err) {
		console.error(err);
		try { if (conn) await conn.rollback(); } catch (_) {}
		return res.status(500).json({ response: "Server error." });
	} finally {
		if (conn) conn.release();
	}
});

module.exports = router;
