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
from dotenv import load_dotenv

load_dotenv()

groq_client = OpenAI(
    api_key=os.environ.get("GROQ_API_KEY"),
    base_url="https://api.groq.com/openai/v1",
)

app = FastAPI()

# Enable CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

@app.get("/")
async def root():
    return {"message": "Real Estate Chatbot API"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
