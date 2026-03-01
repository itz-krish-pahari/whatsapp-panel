const { Client, LocalAuth, MessageMedia, Buttons, List, Poll } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const path = require('path');
const fs = require('fs');
const EventEmitter = require('events');
const logger = require('../utils/logger');

class WhatsAppSessionManager extends EventEmitter {
  constructor(io) {
    super();
    this.io = io;
    this.sessions = new Map(); // sessionId -> { client, status, qr, info }
    this.sessionsDir = path.join(__dirname, '../../sessions');
    if (!fs.existsSync(this.sessionsDir)) {
      fs.mkdirSync(this.sessionsDir, { recursive: true });
    }
  }

  // ─── Session Lifecycle ───────────────────────────────────────────────────

  async createSession(sessionId, label = '') {
    if (this.sessions.has(sessionId)) {
      return { success: false, message: 'Session already exists' };
    }

    logger.info(`Creating session: ${sessionId}`);
    const sessionData = { client: null, status: 'initializing', qr: null, qrDataUrl: null, info: null, label };
    this.sessions.set(sessionId, sessionData);
    this._broadcastSessions();

    try {
      const client = new Client({
        authStrategy: new LocalAuth({
          clientId: sessionId,
          dataPath: this.sessionsDir
        }),
        puppeteer: {
          headless: process.env.WA_HEADLESS !== 'false',
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
          ]
        },
        webVersionCache: {
          type: 'remote',
          remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html'
        }
      });

      sessionData.client = client;

      client.on('qr', async (qr) => {
        logger.info(`QR received for session: ${sessionId}`);
        const qrDataUrl = await qrcode.toDataURL(qr);
        sessionData.status = 'qr_ready';
        sessionData.qr = qr;
        sessionData.qrDataUrl = qrDataUrl;
        this.io.to(sessionId).emit('qr', { sessionId, qrDataUrl });
        this.io.emit('session_update', this._getSessionInfo(sessionId));
      });

      client.on('authenticated', () => {
        logger.info(`Session authenticated: ${sessionId}`);
        sessionData.status = 'authenticated';
        sessionData.qr = null;
        sessionData.qrDataUrl = null;
        this.io.to(sessionId).emit('authenticated', { sessionId });
        this.io.emit('session_update', this._getSessionInfo(sessionId));
      });

      client.on('auth_failure', (msg) => {
        logger.error(`Auth failure for session ${sessionId}: ${msg}`);
        sessionData.status = 'auth_failed';
        this.io.to(sessionId).emit('auth_failure', { sessionId, message: msg });
        this.io.emit('session_update', this._getSessionInfo(sessionId));
      });

      client.on('ready', async () => {
        logger.info(`Session ready: ${sessionId}`);
        sessionData.status = 'connected';
        try {
          const info = await client.info;
          sessionData.info = {
            name: info.pushname,
            number: info.wid.user,
            platform: info.platform
          };
        } catch (e) { /* ignore */ }
        this.io.to(sessionId).emit('ready', { sessionId, info: sessionData.info });
        this.io.emit('session_update', this._getSessionInfo(sessionId));
      });

      client.on('disconnected', (reason) => {
        logger.warn(`Session disconnected: ${sessionId}, reason: ${reason}`);
        sessionData.status = 'disconnected';
        this.io.to(sessionId).emit('disconnected', { sessionId, reason });
        this.io.emit('session_update', this._getSessionInfo(sessionId));
      });

      client.on('message', (msg) => {
        this._handleIncomingMessage(sessionId, msg);
      });

      client.on('message_ack', (msg, ack) => {
        this.io.emit('message_ack', { sessionId, messageId: msg.id.id, ack });
      });

      await client.initialize();
      return { success: true, message: 'Session initializing, scan QR code' };

    } catch (err) {
      logger.error(`Failed to create session ${sessionId}:`, err);
      sessionData.status = 'error';
      this.sessions.delete(sessionId);
      return { success: false, message: err.message };
    }
  }

  async deleteSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return { success: false, message: 'Session not found' };

    try {
      if (session.client) {
        await session.client.destroy();
      }
      // Remove saved auth data
      const authPath = path.join(this.sessionsDir, `session-${sessionId}`);
      if (fs.existsSync(authPath)) {
        fs.rmSync(authPath, { recursive: true, force: true });
      }
      this.sessions.delete(sessionId);
      this.io.emit('session_removed', { sessionId });
      this._broadcastSessions();
      return { success: true, message: 'Session deleted' };
    } catch (err) {
      logger.error(`Error deleting session ${sessionId}:`, err);
      return { success: false, message: err.message };
    }
  }

  async restoreExistingSessions() {
    const dirs = fs.readdirSync(this.sessionsDir);
    for (const dir of dirs) {
      if (dir.startsWith('session-')) {
        const sessionId = dir.replace('session-', '');
        logger.info(`Restoring session: ${sessionId}`);
        await this.createSession(sessionId);
      }
    }
  }

  // ─── Message Senders ─────────────────────────────────────────────────────

  async sendTextMessage(sessionId, to, text, options = {}) {
    const client = this._getClient(sessionId);
    const chatId = this._formatNumber(to);

    const msgOptions = {};
    if (options.quotedMessageId) msgOptions.quotedMessageId = options.quotedMessageId;
    if (options.mentions) msgOptions.mentions = options.mentions;

    const msg = await client.sendMessage(chatId, text, msgOptions);
    return this._formatMessageResponse(msg);
  }

  async sendImage(sessionId, to, filePath, caption = '', options = {}) {
    const client = this._getClient(sessionId);
    const chatId = this._formatNumber(to);

    const media = filePath.startsWith('http')
      ? await MessageMedia.fromUrl(filePath, { unsafeMime: true })
      : MessageMedia.fromFilePath(filePath);

    const msgOptions = { caption };
    if (options.viewOnce) msgOptions.isViewOnce = true;

    const msg = await client.sendMessage(chatId, media, msgOptions);
    return this._formatMessageResponse(msg);
  }

  async sendDocument(sessionId, to, filePath, filename, caption = '') {
    const client = this._getClient(sessionId);
    const chatId = this._formatNumber(to);

    const media = filePath.startsWith('http')
      ? await MessageMedia.fromUrl(filePath, { unsafeMime: true })
      : MessageMedia.fromFilePath(filePath);

    if (filename) media.filename = filename;

    const msg = await client.sendMessage(chatId, media, {
      caption,
      sendMediaAsDocument: true
    });
    return this._formatMessageResponse(msg);
  }

  async sendAudio(sessionId, to, filePath) {
    const client = this._getClient(sessionId);
    const chatId = this._formatNumber(to);
    const media = MessageMedia.fromFilePath(filePath);
    const msg = await client.sendMessage(chatId, media, { sendAudioAsVoice: true });
    return this._formatMessageResponse(msg);
  }

  async sendVideo(sessionId, to, filePath, caption = '') {
    const client = this._getClient(sessionId);
    const chatId = this._formatNumber(to);
    const media = MessageMedia.fromFilePath(filePath);
    const msg = await client.sendMessage(chatId, media, { caption });
    return this._formatMessageResponse(msg);
  }

  async sendLocation(sessionId, to, latitude, longitude, name = '', address = '') {
    const client = this._getClient(sessionId);
    const chatId = this._formatNumber(to);
    const { Location } = require('whatsapp-web.js');
    const location = new Location(parseFloat(latitude), parseFloat(longitude), name, address);
    const msg = await client.sendMessage(chatId, location);
    return this._formatMessageResponse(msg);
  }

  async sendContact(sessionId, to, contactNumber) {
    const client = this._getClient(sessionId);
    const chatId = this._formatNumber(to);
    const contact = await client.getContactById(this._formatNumber(contactNumber));
    const vcard = contact.getContact ? await contact.getContact() : contact;
    const msg = await client.sendMessage(chatId, vcard);
    return this._formatMessageResponse(msg);
  }

  async sendButtons(sessionId, to, body, buttons, title = '', footer = '') {
    const client = this._getClient(sessionId);
    const chatId = this._formatNumber(to);

    const btns = buttons.map((b, i) => ({
      id: b.id || `btn_${i}`,
      body: b.text || b.body
    }));

    const buttonMsg = new Buttons(body, btns, title, footer);
    const msg = await client.sendMessage(chatId, buttonMsg);
    return this._formatMessageResponse(msg);
  }

  async sendList(sessionId, to, title, body, buttonText, sections, footer = '') {
    const client = this._getClient(sessionId);
    const chatId = this._formatNumber(to);
    const list = new List(body, buttonText, sections, title, footer);
    const msg = await client.sendMessage(chatId, list);
    return this._formatMessageResponse(msg);
  }

  async sendPoll(sessionId, to, question, options, allowMultipleAnswers = false) {
    const client = this._getClient(sessionId);
    const chatId = this._formatNumber(to);
    const poll = new Poll(question, options, { allowMultipleAnswers });
    const msg = await client.sendMessage(chatId, poll);
    return this._formatMessageResponse(msg);
  }

  async sendLink(sessionId, to, url, text = '') {
    const client = this._getClient(sessionId);
    const chatId = this._formatNumber(to);
    const content = text ? `${text}\n${url}` : url;
    const msg = await client.sendMessage(chatId, content, { linkPreview: true });
    return this._formatMessageResponse(msg);
  }

  async sendBulkMessages(sessionId, recipients, messageConfig, delayMs = 1500) {
    const results = [];
    for (const to of recipients) {
      try {
        let result;
        switch (messageConfig.type) {
          case 'text': result = await this.sendTextMessage(sessionId, to, messageConfig.text); break;
          case 'image': result = await this.sendImage(sessionId, to, messageConfig.filePath, messageConfig.caption); break;
          case 'document': result = await this.sendDocument(sessionId, to, messageConfig.filePath, messageConfig.filename, messageConfig.caption); break;
          default: result = await this.sendTextMessage(sessionId, to, messageConfig.text || '');
        }
        results.push({ to, success: true, messageId: result.id });
      } catch (err) {
        results.push({ to, success: false, error: err.message });
      }
      // Delay between messages to avoid spam detection
      if (delayMs > 0) await new Promise(r => setTimeout(r, delayMs));
    }
    return results;
  }

  // ─── Chat Utilities ───────────────────────────────────────────────────────

  async getChats(sessionId) {
    const client = this._getClient(sessionId);
    const chats = await client.getChats();
    return chats.slice(0, 50).map(c => ({
      id: c.id._serialized,
      name: c.name,
      isGroup: c.isGroup,
      unreadCount: c.unreadCount,
      timestamp: c.timestamp,
      lastMessage: c.lastMessage ? {
        body: c.lastMessage.body,
        timestamp: c.lastMessage.timestamp
      } : null
    }));
  }

  async getMessages(sessionId, chatId, limit = 20) {
    const client = this._getClient(sessionId);
    const chat = await client.getChatById(chatId);
    const messages = await chat.fetchMessages({ limit });
    return messages.map(m => ({
      id: m.id.id,
      body: m.body,
      from: m.from,
      to: m.to,
      timestamp: m.timestamp,
      type: m.type,
      fromMe: m.fromMe,
      hasMedia: m.hasMedia
    }));
  }

  async getContacts(sessionId) {
    const client = this._getClient(sessionId);
    const contacts = await client.getContacts();
    return contacts
      .filter(c => c.isMyContact)
      .map(c => ({
        id: c.id._serialized,
        name: c.name || c.pushname,
        number: c.number,
        isGroup: c.isGroup,
        isBlocked: c.isBlocked
      }));
  }

  async getGroups(sessionId) {
    const client = this._getClient(sessionId);
    const chats = await client.getChats();
    const groups = chats.filter(c => c.isGroup);
    return groups.map(g => ({
      id: g.id._serialized,
      name: g.name,
      participantsCount: g.participants ? g.participants.length : 0,
      description: g.description
    }));
  }

  async getProfilePicUrl(sessionId, contactId) {
    const client = this._getClient(sessionId);
    try {
      return await client.getProfilePicUrl(this._formatNumber(contactId));
    } catch {
      return null;
    }
  }

  async checkNumber(sessionId, number) {
    const client = this._getClient(sessionId);
    const result = await client.isRegisteredUser(this._formatNumber(number));
    return { number, isRegistered: result };
  }

  async setStatus(sessionId, status) {
    const client = this._getClient(sessionId);
    await client.setStatus(status);
    return { success: true };
  }

  async markAsRead(sessionId, chatId) {
    const client = this._getClient(sessionId);
    const chat = await client.getChatById(chatId);
    await chat.sendSeen();
    return { success: true };
  }

  // ─── Session Info ─────────────────────────────────────────────────────────

  getAllSessions() {
    const result = [];
    for (const [id] of this.sessions) {
      result.push(this._getSessionInfo(id));
    }
    return result;
  }

  getSession(sessionId) {
    return this.sessions.get(sessionId) || null;
  }

  _getSessionInfo(sessionId) {
    const s = this.sessions.get(sessionId);
    if (!s) return null;
    return {
      sessionId,
      label: s.label,
      status: s.status,
      qrDataUrl: s.qrDataUrl,
      info: s.info
    };
  }

  _getClient(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session '${sessionId}' not found`);
    if (session.status !== 'connected') throw new Error(`Session '${sessionId}' is not connected (status: ${session.status})`);
    return session.client;
  }

  _formatNumber(number) {
    if (number.includes('@')) return number;
    const cleaned = number.replace(/\D/g, '');
    return `${cleaned}@c.us`;
  }

  _formatMessageResponse(msg) {
    return {
      id: msg.id.id,
      to: msg.to,
      timestamp: msg.timestamp,
      type: msg.type,
      status: 'sent'
    };
  }

  _handleIncomingMessage(sessionId, msg) {
    const data = {
      sessionId,
      id: msg.id.id,
      from: msg.from,
      to: msg.to,
      body: msg.body,
      type: msg.type,
      timestamp: msg.timestamp,
      hasMedia: msg.hasMedia,
      fromMe: msg.fromMe,
      isGroup: msg.from.endsWith('@g.us')
    };
    this.io.emit('new_message', data);
    logger.info(`Incoming message on ${sessionId} from ${msg.from}: ${msg.body?.substring(0, 50)}`);
  }

  _broadcastSessions() {
    this.io.emit('sessions_list', this.getAllSessions());
  }
}

module.exports = WhatsAppSessionManager;
