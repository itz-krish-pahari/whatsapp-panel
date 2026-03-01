const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { requireAuth } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validator');
const logger = require('../utils/logger');

const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: (parseInt(process.env.MAX_FILE_SIZE_MB) || 50) * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    // Allow images, docs, audio, video
    const allowed = /jpeg|jpg|png|gif|webp|pdf|doc|docx|xls|xlsx|ppt|pptx|txt|csv|mp3|ogg|mp4|avi|mov/;
    const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
    cb(null, allowed.test(ext));
  }
});

module.exports = (manager) => {

  /**
   * POST /api/messages/text
   * Send a text message
   */
  router.post('/text', requireAuth, validate(schemas.sendText), async (req, res) => {
    try {
      const { sessionId, to, text, quotedMessageId } = req.body;
      const result = await manager.sendTextMessage(sessionId, to, text, { quotedMessageId });
      res.json({ success: true, data: result });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  /**
   * POST /api/messages/image
   * Send an image (upload file or URL)
   */
  router.post('/image', requireAuth, upload.single('file'), async (req, res) => {
    try {
      const { sessionId, to, caption, url } = req.body;
      if (!sessionId || !to) return res.status(400).json({ success: false, message: 'sessionId and to are required' });

      const filePath = url || (req.file ? req.file.path : null);
      if (!filePath) return res.status(400).json({ success: false, message: 'Provide either a file upload or url' });

      const result = await manager.sendImage(sessionId, to, filePath, caption || '');
      res.json({ success: true, data: result });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  /**
   * POST /api/messages/document
   * Send a document/file
   */
  router.post('/document', requireAuth, upload.single('file'), async (req, res) => {
    try {
      const { sessionId, to, caption, filename, url } = req.body;
      if (!sessionId || !to) return res.status(400).json({ success: false, message: 'sessionId and to are required' });

      const filePath = url || (req.file ? req.file.path : null);
      if (!filePath) return res.status(400).json({ success: false, message: 'Provide either a file upload or url' });

      const result = await manager.sendDocument(sessionId, to, filePath, filename, caption || '');
      res.json({ success: true, data: result });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  /**
   * POST /api/messages/audio
   * Send an audio/voice message
   */
  router.post('/audio', requireAuth, upload.single('file'), async (req, res) => {
    try {
      const { sessionId, to } = req.body;
      if (!sessionId || !to || !req.file) return res.status(400).json({ success: false, message: 'sessionId, to, and file are required' });

      const result = await manager.sendAudio(sessionId, to, req.file.path);
      res.json({ success: true, data: result });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  /**
   * POST /api/messages/video
   * Send a video
   */
  router.post('/video', requireAuth, upload.single('file'), async (req, res) => {
    try {
      const { sessionId, to, caption } = req.body;
      if (!sessionId || !to || !req.file) return res.status(400).json({ success: false, message: 'sessionId, to, and file are required' });

      const result = await manager.sendVideo(sessionId, to, req.file.path, caption || '');
      res.json({ success: true, data: result });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  /**
   * POST /api/messages/location
   * Send a location pin
   */
  router.post('/location', requireAuth, validate(schemas.sendLocation), async (req, res) => {
    try {
      const { sessionId, to, latitude, longitude, name, address } = req.body;
      const result = await manager.sendLocation(sessionId, to, latitude, longitude, name, address);
      res.json({ success: true, data: result });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  /**
   * POST /api/messages/buttons
   * Send interactive button message
   */
  router.post('/buttons', requireAuth, validate(schemas.sendButtons), async (req, res) => {
    try {
      const { sessionId, to, body, buttons, title, footer } = req.body;
      const result = await manager.sendButtons(sessionId, to, body, buttons, title, footer);
      res.json({ success: true, data: result });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  /**
   * POST /api/messages/list
   * Send interactive list message
   */
  router.post('/list', requireAuth, validate(schemas.sendList), async (req, res) => {
    try {
      const { sessionId, to, title, body, buttonText, sections, footer } = req.body;
      const result = await manager.sendList(sessionId, to, title, body, buttonText, sections, footer);
      res.json({ success: true, data: result });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  /**
   * POST /api/messages/poll
   * Send a poll
   */
  router.post('/poll', requireAuth, validate(schemas.sendPoll), async (req, res) => {
    try {
      const { sessionId, to, question, options, allowMultipleAnswers } = req.body;
      const result = await manager.sendPoll(sessionId, to, question, options, allowMultipleAnswers);
      res.json({ success: true, data: result });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  /**
   * POST /api/messages/link
   * Send a link with preview
   */
  router.post('/link', requireAuth, validate(schemas.sendLink), async (req, res) => {
    try {
      const { sessionId, to, url, text } = req.body;
      const result = await manager.sendLink(sessionId, to, url, text);
      res.json({ success: true, data: result });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  /**
   * POST /api/messages/bulk
   * Send bulk messages
   */
  router.post('/bulk', requireAuth, validate(schemas.sendBulk), async (req, res) => {
    try {
      const { sessionId, recipients, messageConfig, delayMs } = req.body;
      // Return immediately, process in background
      res.json({ success: true, message: `Bulk send started for ${recipients.length} recipients` });
      // Run async
      manager.sendBulkMessages(sessionId, recipients, messageConfig, delayMs);
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  /**
   * POST /api/messages/check-number
   * Check if a number is registered on WhatsApp
   */
  router.post('/check-number', requireAuth, validate(schemas.checkNumber), async (req, res) => {
    try {
      const { sessionId, number } = req.body;
      const result = await manager.checkNumber(sessionId, number);
      res.json({ success: true, data: result });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  return router;
};
