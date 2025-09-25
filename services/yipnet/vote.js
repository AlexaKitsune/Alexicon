const express = require("express");
const mysql = require("mysql2/promise");
const getIdByToken = require("../../utils/getIdByToken");
const router = express.Router();
const { emitToUser } = require('../../utils/socket');

async function getConnection() {
  return await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
  });
}

// POST /yipnet/vote
router.post("/vote", async (req, res) => {
  const { voteType, targetId, entityType } = req.body;

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ response: "Missing or invalid token." });
  }

  const token = authHeader.split(" ")[1];
  const myId = await getIdByToken(token);
  if (!myId) {
    return res.status(403).json({ response: "Unauthorized user." });
  }

  if (!voteType || !targetId || !entityType) {
    return res.status(400).json({ response: "Missing required fields." });
  }

  if (!["heart", "up", "down"].includes(voteType)) {
    return res.status(400).json({ response: "Invalid voteType." });
  }

  // ⬇️ Aceptamos "message"
  if (!["post", "comment", "message"].includes(entityType)) {
    return res.status(400).json({ response: "Invalid entityType." });
  }

  try {
    const conn = await getConnection();

    // ⬇️ Tabla y columna de votos
    const table =
      entityType === "post" ? "posts" :
      entityType === "comment" ? "comments" :
      "messages";

    const column =
      voteType === "heart" ? "list_vote_heart" :
      voteType === "up"    ? "list_vote_up" :
                             "list_vote_down";

    // Cargar lista actual
    const [rows] = await conn.query(
      `SELECT \`${column}\` FROM \`${table}\` WHERE id = ?`,
      [targetId]
    );

    if (rows.length === 0) {
      await conn.end();
      return res.status(404).json({ response: "Target not found." });
    }

    let voteList = [];
    try {
      voteList = JSON.parse(rows[0][column] || "[]");
      if (!Array.isArray(voteList)) voteList = [];
    } catch {
      voteList = [];
    }

    const alreadyVoted = voteList.includes(myId);
    if (alreadyVoted) {
      voteList = voteList.filter(id => id !== myId);
    } else {
      voteList.push(myId);
    }

    await conn.query(
      `UPDATE \`${table}\` SET \`${column}\` = ? WHERE id = ?`,
      [JSON.stringify(voteList), targetId]
    );

    // ===== Notificación =====
    // Para posts/comments: owner_id
    // Para messages: usamos sender_id como "dueño" del mensaje
    let targetOwnerId = null;

    if (entityType === "message") {
      const [msgRows] = await conn.query(
        "SELECT sender_id FROM messages WHERE id = ?",
        [targetId]
      );
      targetOwnerId = msgRows[0]?.sender_id ?? null;
    } else {
      const [tRows] = await conn.query(
        `SELECT owner_id FROM \`${table}\` WHERE id = ?`,
        [targetId]
      );
      targetOwnerId = tRows[0]?.owner_id ?? null;
    }

    if (targetOwnerId && targetOwnerId !== myId) {
      const [userDataResult] = await conn.query(
        "SELECT id, name, surname, current_profile_pic, services FROM users WHERE id = ?",
        [myId]
      );
      const userData = userDataResult[0];

      const notificationContent = {
        user: userData,
        targetId,
        voteType,
        entityType,
        status: alreadyVoted ? "removed" : "added",
        timestamp: new Date().toISOString(),
      };

      await conn.query(
        "INSERT INTO notifications (owner_id, content, service) VALUES (?, ?, ?)",
        [targetOwnerId, JSON.stringify(notificationContent), "yipnet"]
      );

      emitToUser(targetOwnerId, "yipnet_notification", {
        message: "You have a new notification",
        timestamp: new Date().toISOString(),
      });
    }

    await conn.end();

    return res.json({
      response: "Vote updated",
      status: alreadyVoted ? "removed" : "added",
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ response: "Server error." });
  }
});

module.exports = router;
