const jwt = require('jsonwebtoken');
const mysql = require('mysql2/promise');

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
        const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
        const userEmail = decoded.identity;

        const conn = await getConnection();
        const [rows] = await conn.execute(
            'SELECT id FROM users WHERE email = ? OR at_sign = ?',
            [userEmail, userEmail]
        );
        await conn.end();

        if (rows.length > 0) {
            return rows[0].id;
        } else {
            return null;
        }
    } catch (err) {
        console.error("Error decoding token or querying DB:", err);
        return null;
    }
}

module.exports = getIdByToken;
