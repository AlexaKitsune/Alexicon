const express = require('express');
const pool = require('../../utils/dbConn');

const router = express.Router();

const FIELDS = ["id", "name", "surname", "nickname", "at_sign", "birthday", "gender", "description", "current_profile_pic", "current_cover_pic", "list_positive", "list_negative", "list_positive_external", "list_negative_external", "services", "api_code"];

router.post('/retrieve_users', async (req, res) => {
    const { ids } = req.body;

    if (!Array.isArray(ids)) {
        return res.status(400).json({ error: 'Invalid ids array' });
    }

    // Asegura números finitos
    const safeIds = ids.map(Number).filter(Number.isFinite);
    if (safeIds.length !== ids.length)
        return res.status(400).json({ error: 'Invalid ids array' });

    if (safeIds.length === 0)
        return res.json([]); // vacío si no hay ids

    try {
        const placeholders = safeIds.map(() => '?').join(',');

        const sql = `
        SELECT ${FIELDS.join(', ')}
        FROM users
        WHERE id IN (${placeholders})
        ORDER BY FIELD(id, ${placeholders})`;

        // Usamos los ids dos veces: IN (...) y FIELD(...)
        const params = [...safeIds, ...safeIds];

        const [rows] = await pool.execute(sql, params);

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
            // Se devuelven tal cual vienen (como en tu versión original)
            list_positive: user.list_positive,
            list_negative: user.list_negative,
            list_positive_external: user.list_positive_external,
            list_negative_external: user.list_negative_external,
            services: user.services,
            api_code: user.api_code ? 1 : 0,
        }));

        res.json(result);
    } catch (error) {
        console.error('Error retrieving users:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;