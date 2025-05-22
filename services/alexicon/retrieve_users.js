const express = require('express');
const mysql = require('mysql2/promise');
const router = express.Router();

async function getConnection() {
    return await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASS,
        database: process.env.DB_NAME,
    });
}

router.post('/retrieve_users', async (req, res) => {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.some(id => typeof id !== 'number')) {
        return res.status(400).json({ error: 'Invalid ids array' });
    }

    if (ids.length === 0) {
        return res.json([]); // devuelve vacío si no hay ids
    }

    try {
        const connection = await getConnection();

        const placeholders = ids.map(() => '?').join(',');
        const query = `
            SELECT
                id,
                name,
                surname,
                nickname,
                at_sign,
                birthday,
                gender,
                description,
                current_profile_pic,
                current_cover_pic,
                list_positive,
                list_negative,
                list_positive_external,
                list_negative_external,
                services,
                api_code
            FROM users
            WHERE id IN (${placeholders})
        `;

        const [rows] = await connection.execute(query, ids);

        await connection.end(); // Cerrar la conexión después de usarla

        const result = rows.map(user => ({
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
            services: user.services,
            api_code: user.api_code ? 1 : 0
        }));

        res.json(result);

    } catch (error) {
        console.error('Error retrieving users:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
