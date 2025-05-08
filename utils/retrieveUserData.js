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

async function retrieveUserData(userId) {
    try {
        const conn = await getConnection();
        const [rows] = await conn.execute("SELECT * FROM users WHERE id = ?", [userId]);
        await conn.end();

        if (rows.length === 0) return null;

        const user = rows[0];

        return {
            id: user.id,
            name: user.name,
            surname: user.surname,
            nickname: user.nickname,
            at_sign: user.at_sign,
            birthday: user.birthday,
            gender: user.gender,
            description: user.description,
            current_profile_pic: user.current_profile_pic,
            current_cover_pic: user.current_cover_pic,
            list_positive: user.list_positive,
            list_negative: user.list_negative,
            list_positive_external: user.list_positive_external,
            list_negative_external: user.list_negative_external,
            api_code: user.api_code ? 1 : 0
        };
    } catch (err) {
        console.error("Database error:", err);
        return "Database error.";
    }
}

module.exports = { retrieveUserData };
