# 💬 WhatsApp Panel — Professional Node.js WhatsApp API

A full-featured WhatsApp Web management panel with REST API, real-time dashboard, multi-session support, and all message types.

---

## 🚀 Features

- **Multi-Session Management** — Run multiple WhatsApp accounts simultaneously
- **QR Code Scanner** — Scan via web panel to authenticate
- **Real-time Dashboard** — Live updates via Socket.IO
- **REST API** — Full API with API Key + JWT authentication
- **Message Types:**
  - ✉️ Text messages
  - 🖼️ Images (upload or URL)
  - 📎 Documents/Files (upload or URL)
  - 🎵 Audio / Voice messages
  - 🎥 Video
  - 📍 Location pins
  - 🔘 Button messages (interactive)
  - 📋 List messages (interactive)
  - 📊 Polls
  - 🔗 Links with preview
  - 📣 Bulk sender with delay
- **Session Persistence** — Sessions restored on restart
- **Rate Limiting** — Built-in protection
- **File Upload** — Multer-based, up to 50MB
- **Activity Logging** — Winston logger + live feed

---

## 📦 Installation

```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp .env.example .env
# Edit .env with your settings

# 3. Start the server
npm start

# For development with auto-reload:
npm run dev

# For production with PM2:
npm run pm2
```

---

## ⚙️ Configuration (.env)

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `ADMIN_USERNAME` | `admin` | Panel login username |
| `ADMIN_PASSWORD` | `admin123` | Panel login password |
| `API_KEY` | — | API key for REST access |
| `JWT_SECRET` | — | Secret for JWT tokens |
| `SESSION_SECRET` | — | Express session secret |
| `WA_HEADLESS` | `true` | Headless Chrome for WhatsApp |
| `WA_RESTORE_SESSIONS` | `true` | Auto-restore sessions on start |
| `MAX_FILE_SIZE_MB` | `50` | Max upload size |
| `RATE_LIMIT_MAX_REQUESTS` | `100` | Max API requests per minute |

---

## 🌐 Panel Access

- **URL:** http://localhost:3000
- **Default login:** `admin` / `admin123` *(change in .env)*

---

## 🔌 REST API

### Authentication

**Option 1 — API Key:**
```
X-Api-Key: your_api_key_here
```

**Option 2 — JWT:**
```
Authorization: Bearer <token>
```

**Get JWT Token:**
```bash
curl -X POST http://localhost:3000/auth/token \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

---

### Sessions

```bash
# List sessions
GET /api/sessions

# Get session
GET /api/sessions/:sessionId

# Create session
POST /api/sessions
{"sessionId": "my-phone", "label": "Personal Phone"}

# Delete session
DELETE /api/sessions/:sessionId

# Get chats
GET /api/sessions/:sessionId/chats

# Get contacts
GET /api/sessions/:sessionId/contacts

# Get groups
GET /api/sessions/:sessionId/groups
```

---

### Messages

#### Text Message
```bash
POST /api/messages/text
{
  "sessionId": "my-phone",
  "to": "919876543210",
  "text": "Hello World!"
}
```

#### Image
```bash
POST /api/messages/image
Content-Type: multipart/form-data
  sessionId=my-phone
  to=919876543210
  file=@/path/to/image.jpg  (or url=https://...)
  caption=Optional caption
```

#### Document
```bash
POST /api/messages/document
Content-Type: multipart/form-data
  sessionId=my-phone
  to=919876543210
  file=@/path/to/file.pdf  (or url=https://...)
  filename=report.pdf
  caption=Monthly Report
```

#### Location
```bash
POST /api/messages/location
{
  "sessionId": "my-phone",
  "to": "919876543210",
  "latitude": 37.7749,
  "longitude": -122.4194,
  "name": "San Francisco",
  "address": "California, USA"
}
```

#### Button Message
```bash
POST /api/messages/buttons
{
  "sessionId": "my-phone",
  "to": "919876543210",
  "title": "Choose Option",
  "body": "Please select one of the options below:",
  "footer": "Powered by WA Panel",
  "buttons": [
    {"id": "yes", "text": "Yes"},
    {"id": "no", "text": "No"},
    {"id": "maybe", "text": "Maybe"}
  ]
}
```

#### List Message
```bash
POST /api/messages/list
{
  "sessionId": "my-phone",
  "to": "919876543210",
  "title": "Select Service",
  "body": "Choose a service to continue",
  "buttonText": "View Services",
  "footer": "We'll get back to you",
  "sections": [{
    "title": "Services",
    "rows": [
      {"id": "support", "title": "Customer Support", "description": "Get help"},
      {"id": "sales", "title": "Sales", "description": "Talk to sales team"}
    ]
  }]
}
```

#### Poll
```bash
POST /api/messages/poll
{
  "sessionId": "my-phone",
  "to": "919876543210",
  "question": "What's your favorite color?",
  "options": ["Red", "Blue", "Green", "Yellow"],
  "allowMultipleAnswers": false
}
```

#### Link with Preview
```bash
POST /api/messages/link
{
  "sessionId": "my-phone",
  "to": "919876543210",
  "url": "https://example.com",
  "text": "Check this out!"
}
```

#### Bulk Send
```bash
POST /api/messages/bulk
{
  "sessionId": "my-phone",
  "recipients": ["919876543210", "917654321098"],
  "messageConfig": {
    "type": "text",
    "text": "Hello! This is a broadcast message."
  },
  "delayMs": 2000
}
```

#### Check Number
```bash
POST /api/messages/check-number
{
  "sessionId": "my-phone",
  "number": "919876543210"
}
```

---

## 📁 Project Structure

```
whatsapp-panel/
├── src/
│   ├── server.js                  # Main server entry point
│   ├── services/
│   │   └── whatsappManager.js     # Core WhatsApp session manager
│   ├── routes/
│   │   ├── auth.js                # Login / JWT routes
│   │   ├── sessions.js            # Session management API
│   │   └── messages.js            # Message sending API
│   ├── middleware/
│   │   ├── auth.js                # Auth middleware (session, API key, JWT)
│   │   └── validator.js           # Joi validation schemas
│   └── utils/
│       └── logger.js              # Winston logger
├── public/
│   ├── index.html                 # Main dashboard
│   ├── login.html                 # Login page
│   └── 404.html                   # 404 page
├── sessions/                      # WhatsApp auth data (auto-created)
├── uploads/                       # Uploaded files (auto-created)
├── logs/                          # Log files (auto-created)
├── .env.example
└── package.json
```

---

## 🔒 Security Notes

1. **Change default credentials** in `.env` before deploying
2. **Use HTTPS** in production (put behind nginx with SSL)
3. **Set strong secrets** for `JWT_SECRET` and `SESSION_SECRET`
4. **Keep API_KEY secret** — use environment variables
5. **Don't expose** the panel publicly without authentication

---

## 🐳 Docker (Optional)

```dockerfile
FROM node:18-slim
RUN apt-get update && apt-get install -y chromium \
  --no-install-recommends && rm -rf /var/lib/apt/lists/*
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
EXPOSE 3000
CMD ["node", "src/server.js"]
```

---

## 📝 License

MIT — Use freely for personal and commercial projects.
