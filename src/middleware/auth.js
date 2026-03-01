const jwt = require('jsonwebtoken');

// Panel session auth
function requireLogin(req, res, next) {
  if (req.session && req.session.authenticated) return next();
  return res.redirect('/login');
}

// API key auth
function requireApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;
  if (!apiKey || apiKey !== process.env.API_KEY) {
    return res.status(401).json({ success: false, message: 'Invalid or missing API key' });
  }
  next();
}

// JWT auth
function requireJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Bearer token required' });
  }
  try {
    const token = authHeader.split(' ')[1];
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
}

// Flexible API auth (API key OR JWT)
function requireAuth(req, res, next) {
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;
  if (apiKey && apiKey === process.env.API_KEY) return next();

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      req.user = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
      return next();
    } catch { /* fall through */ }
  }

  return res.status(401).json({ success: false, message: 'Authentication required' });
}

module.exports = { requireLogin, requireApiKey, requireJWT, requireAuth };
