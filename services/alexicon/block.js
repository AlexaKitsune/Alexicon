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
    });
}

router.post('/block', async (req, res) => {
    const { targetId, mode } = req.body;
    const authHeader = req.headers.authorization;
    
    if (!targetId || isNaN(targetId)) {
        return res.status(400).json({ status: "error", message: "Invalid target ID." });
    }

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ status: "error", message: "Missing or invalid token." });
    }

    const token = authHeader.split(" ")[1];
    const myId = await getIdByToken(token);

    if (!myId) {
        return res.status(401).json({ status: "error", message: "Invalid token." });
    }

    try {
        const conn = await getConnection();

        // Obtener los arrays list_negative y list_negative_external del myId y targetId
        const [userRows] = await conn.execute(
            "SELECT list_negative, list_negative_external FROM users WHERE id IN (?, ?)",
            [myId, targetId]
        );

        if (userRows.length < 2) {
            await conn.end();
            return res.status(404).json({ status: "error", message: "User not found." });
        }

        const [myData, targetData] = userRows;
        const listPositive = tryParseJson(myData.list_negative) || [];
        const listPositiveExternal = tryParseJson(targetData.list_negative_external) || [];

        if (mode === "block") {
            // Agregar myId a list_negative_external de targetId y targetId a list_negative de myId si no están ya
            if (!listPositive.includes(targetId)) {
                listPositive.push(targetId);
            }
            if (!listPositiveExternal.includes(myId)) {
                listPositiveExternal.push(myId);
            }
        } else if (mode === "unblock") {
            // Eliminar myId de list_negative de myId y targetId de list_negative_external de targetId si existen
            const myListPositiveIndex = listPositive.indexOf(targetId);
            const targetListPositiveExternalIndex = listPositiveExternal.indexOf(myId);

            if (myListPositiveIndex !== -1) {
                listPositive.splice(myListPositiveIndex, 1);
            }
            if (targetListPositiveExternalIndex !== -1) {
                listPositiveExternal.splice(targetListPositiveExternalIndex, 1);
            }
        } else {
            await conn.end();
            return res.status(400).json({ status: "error", message: "Invalid mode." });
        }

        // Actualizar los arrays en la base de datos
        await conn.execute(
            "UPDATE users SET list_negative = ? WHERE id = ?",
            [JSON.stringify(listPositive), myId]
        );

        await conn.execute(
            "UPDATE users SET list_negative_external = ? WHERE id = ?",
            [JSON.stringify(listPositiveExternal), targetId]
        );

        await conn.end();

        return res.json({ status: "ok", message: mode === "block" ? "Now blocking" : "Unblocked" });

    } catch (error) {
        console.error("Error processing block/unblock:", error);
        return res.status(500).json({ status: "error", message: "Database connection error." });
    }
});

// Función para manejar parsing de JSON
function tryParseJson(value) {
    if (typeof value === 'string') {
        try {
            return JSON.parse(value);
        } catch {
            return value;
        }
    }
    return value;
}

module.exports = router;
