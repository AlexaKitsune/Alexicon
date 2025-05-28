const jwt = require('jsonwebtoken');
const mysql = require('mysql2/promise');
require('dotenv').config();

async function getConnection() {
    return await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASS,
        database: process.env.DB_NAME,
    });
}

async function getIdByToken(token) {
    try {
        // 1. Verifica y decodifica el token JWT
        const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
        const email = decoded.identity;

        const conn = await getConnection();

        // 2. Obtiene el ID del usuario por correo
        const [userRows] = await conn.execute(
            'SELECT id FROM users WHERE email = ?',
            [email]
        );

        if (userRows.length === 0) {
            await conn.end();
            return null;
        }

        const userId = userRows[0].id;

        // 3. Verifica si el token existe en la tabla de tokens activos
        const [tokenRows] = await conn.execute(
            'SELECT * FROM active_tokens WHERE token = ? AND user_id = ?',
            [token, userId]
        );

        await conn.end();

        // 4. Devuelve el ID del usuario si el token es válido y activo
        return tokenRows.length > 0 ? userId : null;

    } catch (err) {
        // Token inválido o expirado
        return null;
    }
}

module.exports = getIdByToken;
