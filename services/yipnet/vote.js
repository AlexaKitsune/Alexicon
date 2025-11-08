const express = require("express");
const pool = require('../../utils/dbConn');
const getIdByToken = require("../../utils/getIdByToken");
const { emitNotification } = require('../../utils/socket');

const router = express.Router();

router.post("/vote", async (req, res) => {
	const { voteType, targetId, entityType } = req.body;

	const authHeader = req.headers.authorization;
	if (!authHeader || !authHeader.startsWith("Bearer "))
		return res.status(401).json({ response: "Missing or invalid token." });

	const token = authHeader.split(" ")[1];
	const myId = await getIdByToken(token);
	if (!myId) return res.status(403).json({ response: "Unauthorized user." });

	if (!voteType || targetId == null || !entityType)
		return res.status(400).json({ response: "Missing required fields." });

	if (!["heart", "up", "down"].includes(voteType))
		return res.status(400).json({ response: "Invalid voteType." });

	if (!["post", "comment", "message"].includes(entityType))
		return res.status(400).json({ response: "Invalid entityType." });

	const TABLES = { post: 'posts', comment: 'comments', message: 'messages' };
	const COLUMNS = { heart: 'list_vote_heart', up: 'list_vote_up', down: 'list_vote_down' };
	const table = TABLES[entityType];
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

		// 1) Cargar lista actual con bloqueo
		const [rows] = await conn.execute(
			`SELECT \`${column}\` FROM \`${table}\` WHERE id = ? FOR UPDATE`,
			[tid]
		);
		if (rows.length === 0) {
			await conn.rollback();
			return res.status(404).json({ response: "Target not found." });
		}

		// 2) Parsear y togglear
		let voteList;
		try {
			const raw = JSON.parse(rows[0][column] || "[]");
			voteList = Array.isArray(raw) ? raw.map(n => Number(n)).filter(Number.isFinite) : [];
		} catch {
			voteList = [];
		}

		const alreadyVoted = voteList.includes(uid);
		const newList = alreadyVoted ? voteList.filter(id => id !== uid) : [...voteList, uid];

		// 3) Guardar
		await conn.execute(
			`UPDATE \`${table}\` SET \`${column}\` = ? WHERE id = ?`,
			[JSON.stringify(newList), tid]
		);

		// 4) Obtener dueño
		let targetOwnerId = null;
		if (entityType === "message") {
			const [msgRows] = await conn.execute(
				"SELECT sender_id AS owner_id FROM messages WHERE id = ?",
				[tid]
			);
			targetOwnerId = msgRows[0]?.owner_id ?? null;
		} else {
			const [tRows] = await conn.execute(
				`SELECT owner_id FROM \`${table}\` WHERE id = ?`,
				[tid]
			);
			targetOwnerId = tRows[0]?.owner_id ?? null;
		}

		// 5) Confirmar transacción antes de notificar
		await conn.commit();

		// 6) Notificar fuera de la TX para no bloquear
		if (Number.isFinite(targetOwnerId) && Number(targetOwnerId) !== uid) {
			const [userDataResult] = await pool.execute(
				"SELECT id, name, surname, current_profile_pic, services FROM users WHERE id = ?",
				[uid]
			);
			const userData = userDataResult[0];

			await emitNotification(targetOwnerId, 'vote', 'yipnet', {
				user: userData,
				targetId: tid,
				voteType,
				entityType,
				status: alreadyVoted ? "removed" : "added",
				timestamp: new Date().toISOString(),
			});
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
