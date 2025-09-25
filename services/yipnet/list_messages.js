const express = require('express');
const mysql = require('mysql2/promise');
const getIdByToken = require('../../utils/getIdByToken');
const router = express.Router();

async function getConnection() {
    return await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASS,
        database: process.env.DB_NAME,
        // optional: decimalNumbers: true
    });
}

/**
 * GET /list_messages
 * Headers:
 *   Authorization: Bearer <token>
 *
 * Respuesta:
 * {
 *   status: "ok",
 *   data: {
 *     dm_latest: [{
 *       message: { ...fila de messages... },
 *       other_user: { id, name, surname, current_profile_pic }
 *     }],
 *     conversations_latest: [{
 *       message: { ...fila de messages... },
 *       conversation: {
 *         id,
 *         name,
 *         current_group_pic,
 *         participants_names: [ "Nombre1", "Nombre2", ... ]
 *       }
 *     }]
 *   }
 * }
 */
router.get('/list_messages', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ status: "error", message: "Missing or invalid token." });
    }

    const token = authHeader.split(' ')[1];
    const userId = await getIdByToken(token);
    if (!userId) {
        return res.status(401).json({ status: "error", message: "Invalid token." });
    }

    let conn;
    try {
        conn = await getConnection();

        // =========================================================
        // A) DMs (conversation_id = 0): último por cada par (userId vs otro)
        //     + datos del otro usuario (nombre + foto)
        // =========================================================
        const [dmRows] = await conn.execute(`
            SELECT 
                m.*,
                CASE WHEN m.sender_id = ? THEN m.receiver_id ELSE m.sender_id END AS other_user_id
            FROM messages m
            INNER JOIN (
                SELECT MAX(id) AS max_id
                FROM messages
                WHERE conversation_id = 0
                  AND (sender_id = ? OR receiver_id = ?)
                GROUP BY LEAST(sender_id, receiver_id),
                         GREATEST(sender_id, receiver_id)
            ) t ON t.max_id = m.id
            ORDER BY m.msg_date DESC, m.id DESC
        `, [userId, userId, userId]);

        // Obtén info del "otro usuario" para cada DM
        let dm_latest = [];
        if (dmRows.length > 0) {
            const otherIds = [...new Set(dmRows.map(r => r.other_user_id))];
            if (otherIds.length > 0) {
                const placeholders = otherIds.map(() => '?').join(',');
                const [otherUsers] = await conn.execute(
                    `SELECT id, name, surname, current_profile_pic FROM users WHERE id IN (${placeholders})`,
                    otherIds
                );
                const otherMap = new Map(otherUsers.map(u => [u.id, u]));
                dm_latest = dmRows.map(m => ({
                    message: m,
                    other_user: otherMap.get(m.other_user_id) || null
                }));
            } else {
                dm_latest = dmRows.map(m => ({ message: m, other_user: null }));
            }
        }

        // =========================================================
        // B) Conversaciones de grupo (conversation_id != 0)
        //     - Encuentra conversaciones donde participa userId
        //     - Toma el último mensaje por conversation_id
        //     - Adjunta current_group_pic y nombres de participantes
        // =========================================================
        // B) Conversaciones de grupo
        const [convRows] = await conn.execute(`
            SELECT id, name, participants, current_group_pic
            FROM conversations
            WHERE JSON_CONTAINS(participants, ?, '$')
        `, [String(userId)]);

        let conversations_latest = [];
        if (convRows.length > 0) {
            const convIds = convRows.map(c => c.id);
            const placeholders = convIds.map(() => '?').join(',');

            // Último mensaje por conversación
            const [latestGroupMsgs] = await conn.execute(`
                SELECT m.*
                FROM messages m
                INNER JOIN (
                    SELECT conversation_id, MAX(id) AS max_id
                    FROM messages
                    WHERE conversation_id IN (${placeholders})
                    GROUP BY conversation_id
                ) t
                  ON t.conversation_id = m.conversation_id
                 AND t.max_id = m.id
                ORDER BY m.msg_date DESC, m.id DESC
            `, convIds);

            // Mapa convId -> conversación
            const convMap = new Map(convRows.map(c => [c.id, c]));

            // Recolectar todos los participant IDs para resolver sus nombres
            const allParticipantIds = new Set();
            for (const c of convRows) {
                try {
                    const arr = Array.isArray(c.participants)
                        ? c.participants
                        : JSON.parse(c.participants || '[]');
                    arr.forEach(id => allParticipantIds.add(Number(id)));
                } catch {
                    // si el JSON viene malformado, ignora
                }
            }

            // Quitar duplicados y mi propio userId (opcional mantenerlo)
            const idList = [...allParticipantIds];
            let nameMap = new Map();
            if (idList.length > 0) {
                const ph = idList.map(() => '?').join(',');
                const [usersRows] = await conn.execute(
                    `SELECT id, name FROM users WHERE id IN (${ph})`,
                    idList
                );
                nameMap = new Map(usersRows.map(u => [u.id, u.name]));
            }

            // Armar respuesta de B
            conversations_latest = latestGroupMsgs.map(m => {
                const c = convMap.get(m.conversation_id);
                let participantsNames = [];
                try {
                    const arr = Array.isArray(c.participants)
                        ? c.participants
                        : JSON.parse(c.participants || '[]');
                    participantsNames = arr
                        .map(Number)
                        .filter(pid => pid !== Number(userId))
                        .map(pid => nameMap.get(pid))
                        .filter(Boolean);
                } catch {
                    participantsNames = [];
                }
                return {
                    message: m,
                    conversation: {
                        id: c.id,
                        name: c.name,
                        current_group_pic: c.current_group_pic || null,
                        participants_names: participantsNames
                    }
                };
            });
        }

        return res.json({
            status: "ok",
            data: {
                dm_latest,
                conversations_latest
            }
        });

    } catch (err) {
        console.error("Error in list_messages endpoint:", err);
        return res.status(500).json({ status: "error", message: "Database error." });
    } finally {
        if (conn) {
            try { await conn.end(); } catch (_) {}
        }
    }
});

module.exports = router;
