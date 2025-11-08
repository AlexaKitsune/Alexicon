const express = require('express');
const pool = require('../../utils/dbConn');
const getIdByToken = require('../../utils/getIdByToken');
const { emitNotification } = require('../../utils/socket');

const router = express.Router();

router.post('/follow', async (req, res) => {
    const { targetId, mode } = req.body;
    const authHeader = req.headers.authorization;

    const tid = Number(targetId);
    if (!Number.isFinite(tid))
        return res.status(400).json({ status: "error", message: "Invalid target ID." });

    if (!["follow", "unfollow"].includes(mode))
        return res.status(400).json({ status: "error", message: "Invalid mode." });

    if (!authHeader || !authHeader.startsWith("Bearer "))
        return res.status(401).json({ status: "error", message: "Missing or invalid token." });

    const token = authHeader.split(" ")[1];
    const myId = await getIdByToken(token);
    if (!myId)
        return res.status(401).json({ status: "error", message: "Invalid token." });
    if (myId === tid)
        return res.status(400).json({ status: "error", message: "Cannot follow yourself." });

    let conn;
    try {
        conn = await pool.getConnection();
        await conn.beginTransaction();

        // Traemos y BLOQUEAMOS ambas filas (en orden: [myData, targetData])
        const [rows] = await conn.execute(
            `SELECT id, list_positive, list_positive_external, name, surname, current_profile_pic, services
            FROM users
            WHERE id IN (?, ?)
            ORDER BY FIELD(id, ?, ?)
            FOR UPDATE`,
            [myId, tid, myId, tid]
        );

        if (rows.length < 2) {
            await conn.rollback();
            return res.status(404).json({ status: "error", message: "User not found." });
        }

        const [myData, targetData] = rows;

        const myPos = toNumArraySafe(tryParseJson(myData.list_positive));
        const targetPosExt = toNumArraySafe(tryParseJson(targetData.list_positive_external));

        if (mode === "follow") {
            if (!myPos.includes(tid)) myPos.push(tid);
            if (!targetPosExt.includes(myId)) targetPosExt.push(myId);
        } else { // "unfollow"
            removeFromArray(myPos, tid);
            removeFromArray(targetPosExt, myId);
        }

        // Persistimos
        await conn.execute(
            "UPDATE users SET list_positive = ? WHERE id = ?",
            [JSON.stringify(myPos), myId]
        );
        await conn.execute(
            "UPDATE users SET list_positive_external = ? WHERE id = ?",
            [JSON.stringify(targetPosExt), tid]
        );

        await conn.commit();

        // Notificación fuera de la TX para no bloquear
        if (mode === "follow") {
            try {
                await emitNotification(tid, 'follow', 'alexicon', {
                message: 'You have a new follower',
                follower: {
                    id: myId,
                    name: myData.name,
                    surname: myData.surname,
                    current_profile_pic: myData.current_profile_pic,
                    services: myData.services,
                },
                timestamp: new Date().toISOString(),
                });
            } catch (notifyErr) {
                console.error('emitNotification error (follow):', notifyErr);
            }
        }

        return res.json({
            status: "ok",
            message: mode === "follow" ? "Now following" : "Unfollowed"
        });

    } catch (error) {
        console.error("Error processing follow/unfollow:", error);
        try { if (conn) await conn.rollback(); } catch {}
        return res.status(500).json({ status: "error", message: "Database connection error." });
    } finally {
        if (conn) conn.release();
    }
});

// Helpers
function tryParseJson(value) {
    if (typeof value === 'string')
        try { return JSON.parse(value); } catch { return value; }
    return value;
}

function toNumArraySafe(v) {
    const arr = Array.isArray(v) ? v : [];
    return arr.map(n => Number(n)).filter(Number.isFinite);
}

function removeFromArray(arr, val) {
    const idx = arr.indexOf(val);
    if (idx !== -1) arr.splice(idx, 1);
}

module.exports = router;
