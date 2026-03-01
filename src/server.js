require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const session = require('express-session');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

const logger = require('./utils/logger');
const WhatsAppSessionManager = require('./services/whatsappManager');
const authRoutes = require('./routes/auth');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

// ─── Security & Middleware ──────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(morgan('combined', { stream: { write: msg => logger.info(msg.trim()) } }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'whatsapp-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: { success: false, message: 'Too many requests, please slow down.' }
});
app.use('/api/', limiter);

// Static files
app.use(express.static(path.join(__dirname, '../public')));

// ─── Initialize WhatsApp Manager ──────────────────────────────────────────────
const manager = new WhatsAppSessionManager(io);

// ─── Routes ────────────────────────────────────────────────────────────────
app.use('/auth', authRoutes);
app.use('/api/sessions', require('./routes/sessions')(manager));
app.use('/api/messages', require('./routes/messages')(manager));

// Panel pages
app.get('/login', (req, res) => {
  if (req.session && req.session.authenticated) return res.redirect('/');
  res.sendFile(path.join(__dirname, '../public/login.html'));
});

app.get('/', (req, res) => {
  if (!req.session || !req.session.authenticated) return res.redirect('/login');
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// API Docs
app.get('/api', (req, res) => {
  res.json({
    name: 'WhatsApp API Panel',
    version: '1.0.0',
    endpoints: {
      auth: {
        'POST /auth/login': 'Login to panel',
        'POST /auth/logout': 'Logout',
        'POST /auth/token': 'Get JWT token',
        'GET /auth/me': 'Get current user'
      },
      sessions: {
        'GET /api/sessions': 'List all sessions',
        'GET /api/sessions/:id': 'Get session info',
        'POST /api/sessions': 'Create new session',
        'DELETE /api/sessions/:id': 'Delete session',
        'GET /api/sessions/:id/chats': 'Get chats',
        'GET /api/sessions/:id/contacts': 'Get contacts',
        'GET /api/sessions/:id/groups': 'Get groups'
      },
      messages: {
        'POST /api/messages/text': 'Send text message',
        'POST /api/messages/image': 'Send image',
        'POST /api/messages/document': 'Send document/file',
        'POST /api/messages/audio': 'Send audio/voice',
        'POST /api/messages/video': 'Send video',
        'POST /api/messages/location': 'Send location',
        'POST /api/messages/buttons': 'Send button message',
        'POST /api/messages/list': 'Send list message',
        'POST /api/messages/poll': 'Send poll',
        'POST /api/messages/link': 'Send link with preview',
        'POST /api/messages/bulk': 'Send bulk messages',
        'POST /api/messages/check-number': 'Check if number is on WhatsApp'
      }
    },
    authentication: {
      apiKey: 'Pass X-Api-Key header or apiKey query param',
      jwt: 'Pass Authorization: Bearer <token> header'
    }
  });
});

// 404
app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ success: false, message: 'Route not found' });
  }
  res.status(404).sendFile(path.join(__dirname, '../public/404.html'));
});

// Error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

// ─── Socket.IO ────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  logger.info(`Socket connected: ${socket.id}`);

  socket.on('join_session', (sessionId) => {
    socket.join(sessionId);
    logger.info(`Socket ${socket.id} joined session room: ${sessionId}`);
    const info = manager._getSessionInfo(sessionId);
    if (info) socket.emit('session_update', info);
  });

  socket.on('leave_session', (sessionId) => {
    socket.leave(sessionId);
  });

  socket.on('disconnect', () => {
    logger.info(`Socket disconnected: ${socket.id}`);
  });
});

// ─── Start Server ──────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;

server.listen(PORT, async () => {
  logger.info(`🚀 WhatsApp Panel running at http://localhost:${PORT}`);
  logger.info(`📋 API Docs: http://localhost:${PORT}/api`);
  logger.info(`🔑 Default login: ${process.env.ADMIN_USERNAME || 'admin'} / ${process.env.ADMIN_PASSWORD || 'admin123'}`);

  // Restore existing sessions on startup
  if (process.env.WA_RESTORE_SESSIONS !== 'false') {
    logger.info('Restoring existing WhatsApp sessions...');
    await manager.restoreExistingSessions();
  }
});

module.exports = { app, server, io };
