from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
import json
from openai import OpenAI
from gtts import gTTS
import speech_recognition as sr
from PIL import Image
from io import BytesIO
import tempfile
import os
import uuid
import base64
import time
import asyncio
import httpx
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

groq_client = OpenAI(
    api_key=os.environ.get("GROQ_API_KEY"),
    base_url="https://api.groq.com/openai/v1",
)

app = FastAPI()

# Enable CORS for React frontend + GitHub Pages
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "https://keshaavraj.github.io",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── ADREC Live Data ────────────────────────────────────────────────────────────
# Credentials are public — embedded in dari.ae/adrec/assets/script/MarketDataGlobal.js
_ADREC_BASE        = "https://marketintel-api.quanta.ae"
_ADREC_BASIC_AUTH  = "ZG10OmU0OGUwMDc3LWQzZTQtNGIzNC1hZGE5LTkxNWY1MjRjMWU0MA=="

_token_cache  = {"token": None, "expires_at": 0}
_data_cache   = {"context": None, "fetched_at": 0}
_DATA_TTL     = 3300   # refresh data every 55 min
_TOKEN_BUFFER = 120    # refresh token 2 min before expiry

async def _get_adrec_token(client: httpx.AsyncClient) -> str | None:
    """Return a valid ADREC access token, auto-refreshing when near expiry."""
    now = time.time()
    if _token_cache["token"] and now < _token_cache["expires_at"] - _TOKEN_BUFFER:
        return _token_cache["token"]
    try:
        resp = await client.post(
            f"{_ADREC_BASE}/auth/clients/token",
            headers={
                "Authorization": f"Basic {_ADREC_BASIC_AUTH}",
                "Content-Type": "application/x-www-form-urlencoded",
                "Accept": "application/json",
            },
            content="grant_type=client_credentials",
        )
        resp.raise_for_status()
        data = resp.json()
        token = data.get("accessToken") or data.get("access_token")
        _token_cache["token"] = token
        _token_cache["expires_at"] = now + 7200  # tokens live 2 hours
        return token
    except Exception as e:
        print(f"[ADREC] Token refresh failed: {e}")
        return None

async def _fetch_adrec_context() -> str | None:
    """Fetch live ADREC data and return a concise context string for the LLM."""
    now = time.time()
    if _data_cache["context"] and (now - _data_cache["fetched_at"]) < _DATA_TTL:
        return _data_cache["context"]

    async with httpx.AsyncClient(timeout=15.0) as client:
        token = await _get_adrec_token(client)
        if not token:
            return _data_cache.get("context")  # return stale cache if available

        headers = {"Authorization": f"Bearer {token}"}
        today   = datetime.now().strftime("%Y-%m-%d")

        try:
            # Fetch all three data points concurrently
            sales_resp, value_resp, volume_resp, lease_resp = await asyncio.gather(
                client.get(f"{_ADREC_BASE}/adrec/recent-sales", headers=headers,
                           params={"fromDate": "2025-01-01", "toDate": today,
                                   "saleApplicationType": "all", "municipality": "all",
                                   "page": 0, "size": 200, "language": "en"}),
                client.get(f"{_ADREC_BASE}/adrec/total-transactional-value", headers=headers,
                           params={"language": "en"}),
                client.get(f"{_ADREC_BASE}/adrec/total-transactional-volume", headers=headers,
                           params={"language": "en"}),
                client.get(f"{_ADREC_BASE}/adrec/rented-resi-units", headers=headers,
                           params={"language": "en"}),
            )

            sales_data  = sales_resp.json()  if sales_resp.status_code  == 200 else {}
            value_data  = value_resp.json()  if value_resp.status_code  == 200 else {}
            volume_data = volume_resp.json() if volume_resp.status_code == 200 else {}
            lease_data  = lease_resp.json()  if lease_resp.status_code  == 200 else {}

            context = _build_context(sales_data, value_data, volume_data, lease_data, today)
            _data_cache["context"]    = context
            _data_cache["fetched_at"] = now
            return context

        except Exception as e:
            print(f"[ADREC] Data fetch failed: {e}")
            return _data_cache.get("context")

def _build_context(sales, value, volume, lease, as_of: str) -> str:
    """Format ADREC raw data into a concise, LLM-readable context block."""
    lines = [
        f"=== LIVE ADREC MARKET DATA (as of {as_of}) ===",
        f"Source: Abu Dhabi Real Estate Centre — https://adrec.gov.ae/en/property_and_index/adrec-dashboard",
        "",
    ]

    # Market summary
    if value or volume:
        txn_val = value.get("txn_value_aed", 0)
        val_yoy = value.get("value_yoy_change", 0)
        txn_vol = volume.get("txn_volume", 0)
        vol_yoy = volume.get("volume_yoy_change", 0)
        lines += [
            "MARKET SUMMARY (2025–present):",
            f"  Total transaction value : AED {txn_val:,.0f} ({val_yoy*100:+.1f}% YoY)",
            f"  Total transactions      : {txn_vol:,} ({vol_yoy*100:+.1f}% YoY)",
        ]

    if lease:
        rented = lease.get("rented_units", 0)
        r_yoy  = lease.get("rented_units_yoy_change", 0)
        lines.append(f"  Active residential leases: {rented:,} units ({r_yoy*100:+.1f}% YoY)")

    # Recent transactions by district
    records = sales.get("content", [])
    if records:
        lines += ["", f"RECENT SALES BY DISTRICT (last {len(records)} registered transactions):"]
        district_map: dict[str, dict] = {}
        for r in records:
            d = r.get("district", "Other")
            if d not in district_map:
                district_map[d] = {"prices": [], "sqm_rates": [], "count": 0, "types": set()}
            district_map[d]["prices"].append(r.get("property_sale_price_aed", 0))
            district_map[d]["sqm_rates"].append(r.get("rate_aed_per_sqm", 0))
            district_map[d]["count"] += 1
            district_map[d]["types"].add(r.get("property_type", ""))

        for district, info in sorted(district_map.items(), key=lambda x: -x[1]["count"]):
            prices = [p for p in info["prices"] if p > 0]
            rates  = [r for r in info["sqm_rates"] if r > 0]
            avg_p  = sum(prices) / len(prices) if prices else 0
            avg_r  = sum(rates)  / len(rates)  if rates  else 0
            types  = ", ".join(t for t in info["types"] if t)
            lines.append(
                f"  {district}: avg AED {avg_p:,.0f} | avg AED {avg_r:,.0f}/sqm | "
                f"{info['count']} txns | {types}"
            )

    lines += ["", "When answering, cite: (Source: ADREC — https://adrec.gov.ae/en/property_and_index/adrec-dashboard)"]
    return "\n".join(lines)

@app.post("/api/chat")
async def chat(message: str = Form(...)):
    """Handle text chat with SSE streaming"""
    def generate():
        try:
            stream = groq_client.chat.completions.create(
                model='openai/gpt-oss-20b',
                messages=[
                    {'role': 'system', 'content': 'You are a professional Abu Dhabi real estate assistant helping with property searches, prices, locations, and advice.'},
                    {'role': 'user', 'content': message}
                ],
                stream=True
            )
            for chunk in stream:
                token = chunk.choices[0].delta.content or ''
                if token:
                    yield f"data: {json.dumps({'token': token})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")

@app.post("/api/chat-with-image")
async def chat_with_image(
    message: str = Form(...),
    image: UploadFile = File(...)
):
    """Handle chat with image analysis — resized + SSE streaming"""
    img_bytes = await image.read()

    # Resize to max 512px to reduce payload size
    img = Image.open(BytesIO(img_bytes))
    img.thumbnail((512, 512), Image.LANCZOS)
    buf = BytesIO()
    img.save(buf, format='JPEG', quality=85)
    img_b64 = base64.b64encode(buf.getvalue()).decode('utf-8')

    def generate():
        try:
            stream = groq_client.chat.completions.create(
                model='meta-llama/llama-4-scout-17b-16e-instruct',
                messages=[
                    {
                        'role': 'user',
                        'content': [
                            {'type': 'text', 'text': f'You are a professional Abu Dhabi real estate assistant. Analyze this property image and answer: {message}'},
                            {'type': 'image_url', 'image_url': {'url': f'data:image/jpeg;base64,{img_b64}'}}
                        ]
                    }
                ],
                stream=True
            )
            for chunk in stream:
                token = chunk.choices[0].delta.content or ''
                if token:
                    yield f"data: {json.dumps({'token': token})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")

@app.post("/api/transcribe")
async def transcribe_audio(audio: UploadFile = File(...)):
    """Transcribe audio to text"""
    try:
        # Save audio temporarily
        audio_bytes = await audio.read()
        with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as tmp_file:
            tmp_file.write(audio_bytes)
            tmp_path = tmp_file.name

        # Transcribe
        recognizer = sr.Recognizer()
        with sr.AudioFile(tmp_path) as source:
            audio_data = recognizer.record(source)
            text = recognizer.recognize_google(audio_data)

        os.remove(tmp_path)
        return {"text": text}
    except Exception as e:
        return {"error": str(e)}

@app.post("/api/text-to-speech")
async def text_to_speech(text: str = Form(...)):
    """Convert text to speech — Groq Orpheus TTS with gTTS fallback"""
    try:
        # Groq TTS max input is 200 characters
        tts_text = text[:197] + "..." if len(text) > 200 else text
        filename = f"{uuid.uuid4()}.wav"
        filepath = f"/tmp/{filename}"

        try:
            speech = groq_client.audio.speech.create(
                model="canopylabs/orpheus-v1-english",
                voice="diana",
                input=tts_text,
                response_format="wav"
            )
            speech.write_to_file(filepath)
        except Exception:
            # Fallback to gTTS
            gtts_text = text[:500] + "..." if len(text) > 500 else text
            filename = filename.replace(".wav", ".mp3")
            filepath = f"/tmp/{filename}"
            gTTS(text=gtts_text, lang='en', slow=False).save(filepath)

        return {"audio_url": f"/api/audio/{filename}"}
    except Exception as e:
        return {"error": str(e)}

@app.get("/api/audio/{filename}")
async def get_audio(filename: str):
    """Serve audio files"""
    filepath = f"/tmp/{filename}"
    media_type = "audio/wav" if filename.endswith(".wav") else "audio/mpeg"
    return FileResponse(filepath, media_type=media_type)

@app.get("/api/adrec-context")
async def adrec_context():
    """Return live ADREC market data as a formatted context string for system prompt injection."""
    try:
        context = await _fetch_adrec_context()
        return {"context": context, "available": context is not None}
    except Exception as e:
        return {"context": None, "available": False, "error": str(e)}

@app.get("/")
async def root():
    return {"message": "Real Estate Chatbot API"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
