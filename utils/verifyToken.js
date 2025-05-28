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

module.exports = async function (req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(401);

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);

        const conn = await getConnection();
        const [rows] = await conn.execute(
            'SELECT * FROM active_tokens WHERE token = ? AND expires_at > NOW()',
            [token]
        );
        await conn.end();

        if (rows.length === 0) return res.sendStatus(403); // Token no está activo

        req.user = decoded;
        next();
    } catch (err) {
        return res.sendStatus(403);
    }
};
