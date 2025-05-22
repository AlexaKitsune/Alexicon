const express = require('express');
const mysql = require('mysql2/promise');
const getIdByToken = require('../../utils/getIdByToken');
const { emitToUser } = require('../../utils/socket'); // <-- agregado aquí
const router = express.Router();

async function getConnection() {
    return await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASS,
        database: process.env.DB_NAME,
    });
}

router.post('/follow', async (req, res) => {
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

        const [userRows] = await conn.execute(
            "SELECT id, list_positive, list_positive_external, name, surname, current_profile_pic, services FROM users WHERE id IN (?, ?)",
            [myId, targetId]
        );

        if (userRows.length < 2) {
            await conn.end();
            return res.status(404).json({ status: "error", message: "User not found." });
        }

        const [myData, targetData] = userRows[0].id === myId
            ? [userRows[0], userRows[1]]
            : [userRows[1], userRows[0]];

        const listPositive = tryParseJson(myData.list_positive) || [];
        const listPositiveExternal = tryParseJson(targetData.list_positive_external) || [];

        if (mode === "follow") {
            if (!listPositive.includes(targetId)) {
                listPositive.push(targetId);
            }
            if (!listPositiveExternal.includes(myId)) {
                listPositiveExternal.push(myId);
            }

            const content = {
                follower_id: myId,
                name: myData.name,
                surname: myData.surname,
                current_profile_pic: myData.current_profile_pic,
                services: myData.services,
                timestamp: new Date().toISOString()
            };

            await conn.execute(
                `INSERT INTO notifications (owner_id, content, service) VALUES (?, ?, ?)`,
                [targetId, JSON.stringify(content), 'alexicon']
            );

            // Enviar alerta por WebSocket
            emitToUser(targetId, 'follow_notification', {
                message: 'You have a new follower',
                type: 'follow',
                follower: {
                    id: myId,
                    name: myData.name,
                    surname: myData.surname,
                    current_profile_pic: myData.current_profile_pic,
                    services: myData.services,
                },
                timestamp: new Date().toISOString()
            });

        } else if (mode === "unfollow") {
            const myIndex = listPositive.indexOf(targetId);
            const targetIndex = listPositiveExternal.indexOf(myId);

            if (myIndex !== -1) listPositive.splice(myIndex, 1);
            if (targetIndex !== -1) listPositiveExternal.splice(targetIndex, 1);
        } else {
            await conn.end();
            return res.status(400).json({ status: "error", message: "Invalid mode." });
        }

        await conn.execute(
            "UPDATE users SET list_positive = ? WHERE id = ?",
            [JSON.stringify(listPositive), myId]
        );

        await conn.execute(
            "UPDATE users SET list_positive_external = ? WHERE id = ?",
            [JSON.stringify(listPositiveExternal), targetId]
        );

        await conn.end();

        return res.json({ status: "ok", message: mode === "follow" ? "Now following" : "Unfollowed" });

    } catch (error) {
        console.error("Error processing follow/unfollow:", error);
        return res.status(500).json({ status: "error", message: "Database connection error." });
    }
});

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
