const jwt = require('jsonwebtoken');
const pool = require('./dbConn');

module.exports = async function verifyToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(401);

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
        const userId = Number(decoded.sub);
        const jti = decoded.jti;

        if (!Number.isFinite(userId) || !jti) return res.sendStatus(403);

        const [rows] = await pool.execute(
            'SELECT 1 FROM active_tokens WHERE jti = ? AND user_id = ? AND expires_at > NOW() LIMIT 1',
            [jti, userId]
        );
        if (rows.length === 0) return res.sendStatus(403);

        req.userId = userId;   // cómodo para usar en rutas
        req.tokenJti = jti;    // útil para /logout del token actual
        req.user = decoded;    // si te sirve el payload completo

        return next();
    } catch (err) {
        return res.sendStatus(403);
    }
};