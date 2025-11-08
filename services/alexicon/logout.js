const express = require('express');
const jwt = require('jsonwebtoken');
const pool = require('../../utils/dbConn');
require('dotenv').config();

const router = express.Router();

// Helper para extraer el token Bearer
function getTokenFromHeader(req) {
	const authHeader = req.headers['authorization'] || req.headers['Authorization'];
	if (!authHeader) return null;
	const parts = authHeader.split(' ');
	if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
	return parts[1];
}

/**
 * POST /logout
 * Revoca SOLO el token actual (por jti + user_id)
 */
router.post('/logout', async (req, res) => {
  const token = getTokenFromHeader(req);
  if (!token) return res.status(401).json({ response: 'Missing token.' });

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
  } catch {
    // Token inválido/expirado: idempotente; responder OK sin revelar nada
    return res.json({ response: 'Logged out successfully.' });
  }

  const userId = Number(decoded.sub);
  const jti = decoded.jti;
  if (!Number.isFinite(userId) || !jti) {
    return res.status(400).json({ response: 'Invalid token payload.' });
  }

  try {
    await pool.execute(
      'DELETE FROM active_tokens WHERE jti = ? AND user_id = ?',
      [jti, userId]
    );
    return res.json({ response: 'Logged out successfully.' });
  } catch (err) {
    console.error('Logout error:', err);
    return res.status(500).json({ response: 'Server error.' });
  }
});

/**
 * POST /logout_all
 * Revoca TODAS las sesiones del usuario (por user_id)
 */
router.post('/logout_all', async (req, res) => {
	const token = getTokenFromHeader(req);
	if (!token) return res.status(401).json({ response: 'Missing token.' });

	let decoded;
	try {
		decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
	} catch {
		return res.status(401).json({ response: 'Invalid or expired token.' });
	}

	const userId = Number(decoded.sub);
	if (!Number.isFinite(userId))
		return res.status(400).json({ response: 'Invalid token payload.' });

	try {
		await pool.execute('DELETE FROM active_tokens WHERE user_id = ?', [userId]);
		return res.json({ response: 'All sessions revoked.' });
	} catch (err) {
		console.error('Logout all error:', err);
		return res.status(500).json({ response: 'Server error.' });
	}
});

module.exports = router;
