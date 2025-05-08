const express = require('express');
const router = express.Router();

router.get('/on', (req, res) => {
    res.json({ active: true });
});

module.exports = router;
