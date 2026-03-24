# Abu Dhabi Real Estate AI

A full-stack AI assistant for Abu Dhabi property search — multi-model Groq stack with real-time SSE streaming, vision analysis, and voice I/O.

**Live demo:** [keshaavraj.github.io/abudhabi-realestate-ai](https://keshaavraj.github.io/abudhabi-realestate-ai/)

---

## Screenshots

**Landing + floating property cards**
![Landing hero](Assets/Screenshot%202026-03-24%20224440.png)

**Feature grid + Abu Dhabi gallery marquee**
![Features section](Assets/Screenshot%202026-03-24%20224628.png)

**Chat interface — sidebar metrics, active models, voice controls**
![Chat interface](Assets/Screenshot%202026-03-24%20224730.png)

**AI response — structured markdown table, investment analysis**
![Investment analysis](Assets/Screenshot%202026-03-24%20224947.png)

**Vision — property image upload → Llama 4 Scout analysis**
![Vision analysis](Assets/Screenshot%202026-03-24%20225337.png)

---

## Architecture

```
Browser
  ├── SSE stream ──────────────────► Groq API (text / vision)
  │                                   ├── openai/gpt-oss-20b         (chat)
  │                                   └── llama-4-scout-17b-16e      (vision)
  │
  └── REST ────────────────────────► FastAPI (localhost:8000)
                                      ├── POST /api/text-to-speech   (Orpheus TTS → gTTS fallback)
                                      ├── POST /api/transcribe       (Google STT)
                                      └── GET  /api/audio/{file}     (WAV/MP3 serving)

GitHub Actions ──► Vite build ──► GitHub Pages  (frontend only)
Docker Compose ──► Frontend (Nginx) + Backend (Uvicorn)  (self-hosted)
```

The frontend calls Groq directly for chat and vision — no backend proxy on the hot path. The FastAPI backend handles only TTS/STT, which keeps inference latency minimal.

---

## AI Models

| Task | Model | Provider |
|------|-------|----------|
| Text chat | `openai/gpt-oss-20b` | Groq |
| Vision / image analysis | `meta-llama/llama-4-scout-17b-16e-instruct` | Groq |
| Text-to-speech | `canopylabs/orpheus-v1-english` (voice: diana) | Groq |
| TTS fallback | gTTS | Google |
| Speech-to-text | SpeechRecognition | Google Speech API |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, Vite 7, React Router 7 |
| Markdown rendering | react-markdown + remark-gfm |
| HTTP / streaming | Fetch API with `ReadableStream` (SSE) |
| Backend | FastAPI, Uvicorn, Python 3.11 |
| Image processing | Pillow (server), Canvas API (client resize) |
| Container | Docker + Docker Compose |
| Web server | Nginx (gzip, immutable caching, SPA routing) |
| CI/CD | GitHub Actions → GitHub Pages |

---

## Engineering Highlights

**SSE streaming** — Chat responses stream token-by-token via `text/event-stream`. The frontend parses `data:` lines incrementally and appends to the message state without waiting for the full response.

**Client-side image optimisation** — Before sending to the vision API, images are resized to max 512px and JPEG-compressed to 85% quality using the Canvas API. This reduces payload size and cuts vision API latency noticeably.

**TTS fallback chain** — Groq Orpheus TTS is attempted first (WAV, max 200 chars). On failure the backend falls back to gTTS (MP3) transparently — no user-visible error.

**Request cancellation** — Each chat submission creates an `AbortController`. Sending a new message cancels any in-flight stream before starting the next one.

**Performance metrics panel** — The sidebar tracks last response time, rolling average, total estimated tokens (`word_count × 1.3`), and message count — useful for evaluating model/prompt performance at a glance.

**Multi-stage Docker builds** — Frontend: Node 20 build stage → Nginx alpine serve stage. Backend: Python 3.11 slim with `requirements.txt` install. Both services are orchestrated via Compose with health checks.

---

## Project Structure

```
abudhabi-realestate-ai/
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── LandingPage.jsx   # Hero, gallery marquee, features grid
│   │   │   └── ChatPage.jsx      # Chat UI, voice, image upload, metrics
│   │   └── App.jsx               # Router (basename for GitHub Pages)
│   ├── vite.config.js            # base: '/abudhabi-realestate-ai/'
│   ├── Dockerfile                # Multi-stage: Node build → Nginx serve
│   └── nginx.conf                # Gzip, caching, SPA fallback
├── backend/
│   ├── server.py                 # FastAPI — TTS, STT, audio serving
│   ├── requirements.txt
│   └── Dockerfile
├── .github/workflows/deploy.yml  # Build → GitHub Pages on push to main
├── docker-compose.yml
└── start.sh                      # One-command local dev startup
```

---

## Quick Start

### Docker (recommended)

```bash
git clone https://github.com/Keshaavraj/abudhabi-realestate-ai.git
cd abudhabi-realestate-ai
```

Set your Groq API key, then:

```bash
docker-compose up --build
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8000`
- API docs: `http://localhost:8000/docs`

### Manual

**Backend**
```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python server.py
```

**Frontend**
```bash
cd frontend
npm install
npm run dev
```

---

## Environment Variables

| Variable | Required by | Purpose |
|----------|-------------|---------|
| `GROQ_API_KEY` | Backend | TTS via Orpheus, STT fallback |
| `VITE_GROQ_API_KEY` | Frontend build | Direct Groq chat + vision calls |

Set `VITE_GROQ_API_KEY` in your environment before running `npm run build`. For the GitHub Pages deployment, add it as a repository secret — the Actions workflow injects it at build time.

---

## Backend API

| Endpoint | Method | Input | Output |
|----------|--------|-------|--------|
| `/api/text-to-speech` | POST | `text` (form) | `{ audio_url }` |
| `/api/transcribe` | POST | `audio` (file) | `{ text }` |
| `/api/audio/{filename}` | GET | path param | WAV / MP3 stream |
| `/` | GET | — | health check |

CORS is configured for `localhost:5173`, `localhost:3000`, and the GitHub Pages origin.

---

## Data Sources

Market data is cited inline in AI responses from these public sources:

| Source | URL | Used for |
|--------|-----|---------|
| ADREC (Abu Dhabi Real Estate Centre) | [adrec.gov.ae](https://adrec.gov.ae/en/property_and_index/adrec-dashboard) | Official transaction volumes, registered sales, price indices |
| PropertyFinder | [propertyfinder.ae](https://www.propertyfinder.ae) | Current listing prices, rental rates, available units |
| Numbeo | [numbeo.com](https://www.numbeo.com/property-investment/country_result.jsp?country=United+Arab+Emirates) | Cost of living context, rent-to-income ratios |

The system prompt instructs the model to cite each source inline when referencing market figures.

---

## License

MIT — for educational and non-commercial use only. See [LICENSE](LICENSE).

---

## Deployment

**GitHub Pages** (frontend only) — push to `main` triggers the workflow: installs deps, runs `vite build`, uploads `dist/` as a Pages artifact. The Vite `base` config and React Router `basename` are both set to `/abudhabi-realestate-ai/` to handle the subpath correctly.

**Self-hosted** — `docker-compose up` brings up both services. Nginx serves the built frontend on port 5173 with gzip compression, one-year immutable caching for hashed assets, and `try_files` fallback for client-side routing.
