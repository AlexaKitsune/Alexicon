const express = require('express');
const pool = require('../../utils/dbConn');
const getIdByToken = require('../../utils/getIdByToken');
const router = express.Router();

router.post('/block', async (req, res) => {
    const { targetId, mode } = req.body;
    const authHeader = req.headers.authorization;

    // Validaciones básicas
    const tid = Number(targetId);
    if (!Number.isFinite(tid))
        return res.status(400).json({ status: "error", message: "Invalid target ID." });

    if (!authHeader || !authHeader.startsWith("Bearer "))
        return res.status(401).json({ status: "error", message: "Missing or invalid token." });

    const token = authHeader.split(" ")[1];
    const myId = await getIdByToken(token);
    if (!myId)
        return res.status(401).json({ status: "error", message: "Invalid token." });

    if (!["block","unblock"].includes(mode))
        return res.status(400).json({ status: "error", message: "Invalid mode." });

    let conn;
    try {
        conn = await pool.getConnection();
        await conn.beginTransaction();

        // Trae ambas filas y BLOQUÉALAS (para consistencia)
        const [rows] = await conn.execute(
            `SELECT id, list_negative, list_negative_external
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

        // Gracias al ORDER BY FIELD, garantizamos el orden: [myData, targetData]
        const [myData, targetData] = rows;

        // Parseos seguros
        const myNeg = toNumArraySafe(tryParseJson(myData.list_negative));
        const targetNegExt = toNumArraySafe(tryParseJson(targetData.list_negative_external));

        if (mode === "block") {
            // Agregar si no están
            if (!myNeg.includes(tid)) myNeg.push(tid);
            if (!targetNegExt.includes(myId)) targetNegExt.push(myId);
        } else {
            // unblock: quitar si están
            removeFromArray(myNeg, tid);
            removeFromArray(targetNegExt, myId);
        }

        // Actualiza ambas filas
        await conn.execute(
            "UPDATE users SET list_negative = ? WHERE id = ?",
            [JSON.stringify(myNeg), myId]
        );
        await conn.execute(
            "UPDATE users SET list_negative_external = ? WHERE id = ?",
            [JSON.stringify(targetNegExt), tid]
        );

        await conn.commit();

        return res.json({ status: "ok", message: mode === "block" ? "Now blocking" : "Unblocked" });
    } catch (error) {
        console.error("Error processing block/unblock:", error);
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
