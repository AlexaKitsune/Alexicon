const express = require('express');
const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');
const crypto = require('crypto');
require('dotenv').config();

const { retrieveUserData } = require('../../utils/retrieveUserData'); // Asegúrate de exportarla correctamente desde retrieve.js

const router = express.Router();

// Conexión a la base de datos
async function getConnection() {
    return await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASS,
        database: process.env.DB_NAME,
    });
}

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

// Ruta de registro
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
        if (!data[field] || !requiredFields[field](data[field])) {
            return res.json({ response: `No ${field}.` });
        }
    }

    try {
        const conn = await getConnection();

        // Verificar si ya existe el usuario
        const [existing] = await conn.execute(
            "SELECT id FROM users WHERE email = ? OR nickname = ?",
            [data.email, data.nickname]
        );

        if (existing.length > 0) {
            await conn.end();
            return res.json({ response: "User exists" });
        }

        // Hashear contraseña
        const hashedPassword = await bcrypt.hash(data.password, 10);
        const verifyKey = generateRandomKey();

        // Insertar nuevo usuario
        const [result] = await conn.execute(`
            INSERT INTO users (email, password, name, surname, nickname, birthday, gender, verify_key)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            data.email,
            hashedPassword,
            data.name,
            data.surname,
            data.nickname,
            data.birthday,
            data.gender,
            verifyKey
        ]);

        const newUserId = result.insertId;

        await conn.end();

        // Obtener datos públicos del nuevo usuario
        const user_data = await retrieveUserData(newUserId);

        return res.json({
            response: "User added successfully.",
            user_data
        });

    } catch (err) {
        console.error("Database error:", err);
        return res.status(500).json({ response: "Database error." });
    }
});

module.exports = router;
