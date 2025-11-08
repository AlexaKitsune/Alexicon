const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const pool = require('../../utils/dbConn');
require('dotenv').config();

const { retrieveUserData } = require('../../utils/retrieveUserData');

const router = express.Router();

// Validadores simples
function validateEmail(email) {
  	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
function validateUsername(text) {
  	return typeof text === "string" && text.length >= 2;
}
function validateDate(date) {
  	return /^\d{4}-\d{2}-\d{2}$/.test(date);
}
function validateGender(gender) {
  	return /^[a-zA-Z]+$/.test(gender);
}
function validatePassword(password) {
  	return /^(?=.*[0-9])(?=.*[a-z])(?=.*[A-Z])(?=.*\W)(?!.* ).{8,128}$/.test(password);
}

// Generar clave de verificación
function generateRandomKey(length = 32) {
  	return crypto.randomBytes(length).toString('hex');
}

router.post('/register', async (req, res) => {
	const data = req.body;

	const requiredFields = {
		email: validateEmail,
		password: validatePassword,
		name: validateUsername,
		surname: validateUsername,
		nickname: validateUsername,
		birthday: validateDate,
		gender: validateGender
	};

	// Validar campos
	for (const field in requiredFields) {
		if (!data[field] || !requiredFields[field](data[field]))
			return res.json({ response: `No ${field}.` });
	}

	try {
		// ¿Existe ya?
		const [existing] = await pool.execute(
			"SELECT id FROM users WHERE email = ? OR nickname = ?",
			[data.email, data.nickname]
		);
		if (existing.length > 0)
			return res.json({ response: "User exists" });

		const hashedPassword = await bcrypt.hash(data.password, 10);
		const verifyKey = generateRandomKey();

		const [result] = await pool.execute(
			`INSERT INTO users (email, password, name, surname, nickname, birthday, gender, verify_key)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				data.email,
				hashedPassword,
				data.name,
				data.surname,
				data.nickname,
				data.birthday,
				data.gender,
				verifyKey
			]
		);

		const newUserId = result.insertId;
		const user_data = await retrieveUserData(newUserId);

		return res.json({ response: "User added successfully.", user_data });
	} catch (err) {
		// Si tienes índices únicos en email/nickname, puedes atrapar duplicados aquí:
		// if (err && err.code === 'ER_DUP_ENTRY') return res.json({ response: "User exists" });
		console.error("Database error:", err);
		return res.status(500).json({ response: "Database error." });
	}
});

module.exports = router;