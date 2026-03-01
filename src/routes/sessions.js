const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validator');
const logger = require('../utils/logger');

module.exports = (manager) => {

  /**
   * GET /api/sessions
   * List all sessions
   */
  router.get('/', requireAuth, (req, res) => {
    res.json({ success: true, data: manager.getAllSessions() });
  });

  /**
   * GET /api/sessions/:sessionId
   * Get specific session info
   */
  router.get('/:sessionId', requireAuth, (req, res) => {
    const info = manager._getSessionInfo(req.params.sessionId);
    if (!info) return res.status(404).json({ success: false, message: 'Session not found' });
    res.json({ success: true, data: info });
  });

  /**
   * POST /api/sessions
   * Create a new session
   */
  router.post('/', requireAuth, validate(schemas.createSession), async (req, res) => {
    const { sessionId, label } = req.body;
    const result = await manager.createSession(sessionId, label);
    if (!result.success) return res.status(400).json(result);
    res.json(result);
  });

  /**
   * DELETE /api/sessions/:sessionId
   * Delete a session
   */
  router.delete('/:sessionId', requireAuth, async (req, res) => {
    const result = await manager.deleteSession(req.params.sessionId);
    if (!result.success) return res.status(400).json(result);
    res.json(result);
  });

  /**
   * GET /api/sessions/:sessionId/chats
   * Get chat list for a session
   */
  router.get('/:sessionId/chats', requireAuth, async (req, res) => {
    try {
      const chats = await manager.getChats(req.params.sessionId);
      res.json({ success: true, data: chats });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  /**
   * GET /api/sessions/:sessionId/chats/:chatId/messages
   * Get messages for a chat
   */
  router.get('/:sessionId/chats/:chatId/messages', requireAuth, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 20;
      const messages = await manager.getMessages(req.params.sessionId, req.params.chatId, limit);
      res.json({ success: true, data: messages });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  /**
   * GET /api/sessions/:sessionId/contacts
   * Get contacts
   */
  router.get('/:sessionId/contacts', requireAuth, async (req, res) => {
    try {
      const contacts = await manager.getContacts(req.params.sessionId);
      res.json({ success: true, data: contacts });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  /**
   * GET /api/sessions/:sessionId/groups
   * Get groups
   */
  router.get('/:sessionId/groups', requireAuth, async (req, res) => {
    try {
      const groups = await manager.getGroups(req.params.sessionId);
      res.json({ success: true, data: groups });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  return router;
};
