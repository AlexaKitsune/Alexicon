const express = require('express');
const { retrieveUserData } = require('../../utils/retrieveUserData'); // Importamos la función reutilizable

const router = express.Router();

// GET /retrieve?id=123
router.get('/retrieve', async (req, res) => {
    const userId = req.query.id;

    if (!userId) {
        return res.status(400).json({ response: "Missing user ID." });
    }

    try {
        const userData = await retrieveUserData(userId);

        if (!userData) {
            return res.status(404).json({ response: "User does not exist." });
        }

        return res.json(userData);
    } catch (err) {
        console.error("Error retrieving user:", err);
        return res.status(500).json({ response: "Database error." });
    }
});

module.exports = router;
