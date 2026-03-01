const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// In a production app, store users in a database
const ADMIN = {
  username: process.env.ADMIN_USERNAME || 'admin',
  // Password is compared in plain text here; for production use hashed passwords
  password: process.env.ADMIN_PASSWORD || 'admin123'
};

/**
 * POST /auth/login
 * Login to panel (session-based)
 */
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN.username && password === ADMIN.password) {
    req.session.authenticated = true;
    req.session.username = username;
    return res.json({ success: true, message: 'Logged in successfully' });
  }
  return res.status(401).json({ success: false, message: 'Invalid credentials' });
});

/**
 * POST /auth/logout
 */
router.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

/**
 * POST /auth/token
 * Generate JWT token for API access
 */
router.post('/token', (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN.username && password === ADMIN.password) {
    const token = jwt.sign(
      { username, role: 'admin' },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '24h' }
    );
    return res.json({ success: true, token, expiresIn: '24h' });
  }
  return res.status(401).json({ success: false, message: 'Invalid credentials' });
});

/**
 * GET /auth/me
 */
router.get('/me', (req, res) => {
  if (req.session && req.session.authenticated) {
    return res.json({ success: true, user: { username: req.session.username, role: 'admin' } });
  }
  return res.status(401).json({ success: false, message: 'Not authenticated' });
});

module.exports = router;
