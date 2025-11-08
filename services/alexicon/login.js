const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { randomUUID } = require('crypto');
const pool = require('../../utils/dbConn');
const { retrieveUserData } = require('../../utils/retrieveUserData');
require('dotenv').config();

const router = express.Router();

router.post('/login', async (req, res) => {
	const data = req.body;

	if (!data.access_word || !data.password)
		return res.json({ response: "Empty email or password." });

	let conn;
	try {
		// 1) Buscar por email o @ (sin abrir conexión dedicada)
		const [rows] = await pool.execute(
			"SELECT * FROM users WHERE email = ? OR at_sign = ?",
			[data.access_word, data.access_word]
		);

		if (rows.length === 0)
		return res.json({ response: "User does not exist." });

		const user = rows[0];

		// 2) Validar contraseña
		const passwordMatches = await bcrypt.compare(data.password, user.password);
		if (!passwordMatches)
			return res.json({ response: "Incorrect email or password." });

		// 3) Firmar JWT (24h) y preparar registro en active_tokens
		const expiresIn = 24 * 60 * 60; // 24h en segundos
		const expiresAt = new Date(Date.now() + expiresIn * 1000);

		const jti = randomUUID();
		const token = jwt.sign(
			{ sub: user.id, jti, email: user.email },
			process.env.JWT_SECRET_KEY,
			{ expiresIn }
		);

		// 4) Escribimos en una TX: política de sesión única (DELETE + INSERT)
		conn = await pool.getConnection();
		await conn.beginTransaction();

		await conn.execute('DELETE FROM active_tokens WHERE user_id = ?', [user.id]);

		await conn.execute(
			'INSERT INTO active_tokens (jti, user_id, expires_at) VALUES (?, ?, ?)',
			[jti, user.id, expiresAt.toISOString().slice(0, 19).replace('T', ' ')]
		);

		await conn.commit();
		conn.release();
		conn = null;

		// 5) Datos públicos del usuario
		const user_data = await retrieveUserData(user.id);

		return res.json({
			response: "Correct login.",
			user_data,
			access_token: token
		});

	} catch (err) {
		console.error("Database error:", err);
		try { if (conn) { await conn.rollback(); conn.release(); } } catch {}
		return res.status(500).json({ response: "Database error." });
	}
});

module.exports = router;
