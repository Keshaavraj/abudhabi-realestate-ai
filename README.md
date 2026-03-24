# React Version - Professional Real Estate AI Platform

Production-ready full-stack application with FastAPI backend and React frontend.

## 🏗️ Architecture

```
react-version/
├── backend/          # FastAPI REST API
│   ├── server.py    # Main API server
│   └── requirements.txt
└── frontend/        # React + Vite SPA
    ├── src/
    │   ├── pages/  # Landing & Chat
    │   └── components/
    └── package.json
```

## 🚀 Setup

### ⚡ Quick Start (One Command)

```bash
./start.sh
```

This automatically starts both backend and frontend! Access at `http://localhost:5173`

Press `Ctrl+C` to stop all servers.

---

### 📝 Manual Setup (Two Terminals)

#### Backend (Terminal 1)

```bash
cd react-version/backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start server
python server.py
```

✅ Backend running at: **http://localhost:8000**

### Frontend (Terminal 2)

**Important for WSL2 users:** Use Linux npm (not Windows npm) to avoid UNC path issues.

```bash
# First-time setup: Install nvm (Node Version Manager)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.nvm/nvm.sh
nvm install --lts
nvm use node

# Verify using Linux npm
which npm  # Should show: /home/username/.nvm/versions/node/...
```

```bash
cd react-version/frontend

# Load nvm in current terminal
source ~/.nvm/nvm.sh && nvm use node

# Install dependencies
npm install

# Start development server
npm run dev
```

✅ Frontend running at: **http://localhost:5173**

**Pro Tip:** Add to `~/.bashrc` to auto-load nvm:
```bash
source ~/.nvm/nvm.sh
nvm use node >/dev/null 2>&1
```

## 📊 Features

### Backend API (FastAPI)
- `/api/chat` - Text conversation
- `/api/chat-with-image` - Image analysis
- `/api/transcribe` - Speech-to-text
- `/api/text-to-speech` - Voice synthesis
- `/api/audio/{filename}` - Audio file serving

### Frontend (React)
- 🏠 **Landing Page**: Professional hero section with feature showcase
- 💬 **Chat Interface**: Real-time messaging with image support
- 📊 **Analytics Dashboard**: Performance metrics, token counting
- 🎤 **Voice Controls**: TTS with speed adjustment (0.5x - 2x)
- 🎨 **Animated UI**: AI-themed neural network backgrounds
- 🔄 **Concurrent Requests**: Proper state management and cancellation

## 🔧 Configuration

### Backend (server.py)
```python
# Customize models
TEXT_MODEL = "llama3.1:8b"
VISION_MODEL = "llava:7b"

# Adjust CORS origins
allow_origins=["http://localhost:5173"]

# Change port
uvicorn.run(app, host="0.0.0.0", port=8000)
```

### Frontend (src/pages/ChatPage.jsx)
```javascript
// API endpoint
const API_BASE = 'http://localhost:8000';

// Voice settings
const [voiceSpeed, setVoiceSpeed] = useState(1.0);
```

## 📦 Production Build

### Frontend
```bash
cd react-version/frontend
npm run build
```

Outputs to `dist/` - serve with nginx/Apache

### Backend
```bash
# Install production server
pip install gunicorn

# Run with gunicorn
gunicorn -w 4 -k uvicorn.workers.UvicornWorker server:app
```

## 🎨 Customization

### Theme Colors
Edit `src/pages/LandingPage.css` and `src/pages/ChatPage.css`:
```css
/* Change gradient colors */
background: linear-gradient(135deg, #YOUR_COLOR1 0%, #YOUR_COLOR2 100%);
```

### Add New Features
1. Add API endpoint in `backend/server.py`
2. Create React component in `src/components/`
3. Update routes in `src/App.jsx`

## 🐛 Troubleshooting

**CORS Errors?**
- Check backend CORS settings match frontend URL
- Ensure both servers are running

**Models Not Found?**
```bash
ollama pull llama3.1:8b
ollama pull llava:7b
```

**Audio Not Working?**
- Check browser permissions for audio playback
- Verify TTS endpoint returns valid MP3

## 🚀 Deployment

### Docker (Coming Soon)
```bash
docker-compose up -d
```

### Manual
1. Deploy backend to cloud (AWS, GCP, Azure)
2. Build frontend: `npm run build`
3. Serve `dist/` folder with CDN
4. Update API_BASE in frontend to production URL

## 📝 Notes

- Backend requires Ollama running locally or remotely
- Frontend optimized for modern browsers (Chrome 90+, Firefox 88+)
- Supports responsive design (desktop/tablet)
- Production ready with error handling and state management

## 🔗 API Documentation

Visit **http://localhost:8000/docs** for interactive Swagger API docs.
