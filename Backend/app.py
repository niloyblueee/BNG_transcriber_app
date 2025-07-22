import os
from pathlib import Path
import tempfile
from flask import Flask, request, jsonify, render_template_string
from dotenv import load_dotenv
from itertools import zip_longest
import re
from openai import OpenAI
from flask_cors import CORS




load_dotenv()                               # reads .env
client = OpenAI()                           # auto‑reads OPENAI_API_KEY

AUDIO_EXTS = {".mp3", ".m4a", ".wav", ".webm", ".ogg"}
AUDIO_FOLDER = Path(__file__).parent        # folder containing app.py

app = Flask(__name__)
CORS(app)

ASCII_RE = re.compile(r'^[\x00-\x7F]+$')   # “pure ASCII” tester

def is_english_token(tok: str) -> bool:
    """Return True if token looks like a real English word (ASCII letters / digits)."""
    tok = tok.strip()
    return bool(tok) and ASCII_RE.fullmatch(tok)

def fix_spelling(transcription: str) -> str:
    """
    Uses GPT-4o Mini to fix Bangla spelling mistakes in the transcription.
    Returns the corrected Bangla text.
    """
    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": "তুমি একজন বানান বিশারদ। তোমার কাজ হলো শুধু ভুল বানান ঠিক করা। বাক্যের গঠন বা ভাষার স্টাইল বদলাবে না। শুধু ভুল বানান সঠিক করো।"
                },
                {
                    "role": "user",
                    "content": f"এই টেক্সটের বানান ঠিক করো:\n\n{transcription}"
                }
            ],
            temperature=0.2,
            max_tokens=1000
        )

        return response.choices[0].message.content.strip()

    except Exception as e:
        print("❌ Spell correction failed:", e)
        return transcription  # fallback to original if error


def summarize_with_gpt_mini(text: str) -> tuple[str, list[str]]:
    """
    Uses GPT-4o Mini to create a short Bengali summary and 3-5 key points.
    Returns (summary, keyPoints_list).
    """
    prompt = (
        "in 4 lines Summarize the transcription of the audio and give key points in Bengali \n\n"
        f"টেক্সট:\n{text}"
    )




    resp = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {
                "role": "system",
                "content": "You are a helpful assistant that summarizes Bengali text."
            },
            {"role": "user", "content": prompt}
        ],
        temperature=0.3
    )

    out = resp.choices[0].message.content.strip()
    # Split first paragraph (summary) vs bullets
    parts = out.split("\n", 1)
    summary = parts[0].strip()
    bullet_block = parts[1] if len(parts) > 1 else ""
    keyPoints = [
        line.lstrip("–- ").strip()
        for line in bullet_block.splitlines()
        if line.strip()
    ]
    return summary, keyPoints





# ---------- transcribe local file ----------
@app.route("/transcribe_local", methods=["POST"])
def transcribe_local():
    """
    Accepts an uploaded audio file and transcribes it.
    """
    uploaded_file = request.files.get("file")
    language = request.form.get("language")  # optional

    if not uploaded_file or uploaded_file.filename == "":
        return jsonify(error="No file uploaded"), 400

    filepath = AUDIO_FOLDER / uploaded_file.filename
    uploaded_file.save(filepath)

    if filepath.suffix.lower() not in AUDIO_EXTS:
        return jsonify(error="Unsupported file type"), 415

    try:
        with filepath.open("rb") as f:
            params = {
                "model": "gpt-4o-mini-transcribe",
                "file": f
            }
            if language == "en":
                params["language"] = "en"
            elif language == "bn":
                params["language"] = "bn"

            transcript = client.audio.transcriptions.create(**params)
            raw_text = transcript.text
            summary, keyPoints = summarize_with_gpt_mini(raw_text)
            corrected_text = fix_spelling(raw_text)

        return jsonify(
            transcription=corrected_text,
            summary=summary,
            keyPoints=keyPoints)

    except Exception as exc:
        return jsonify(error=str(exc)), 500


# ---------- fallback upload endpoint ----------
@app.route("/transcribe", methods=["POST"])
def transcribe_upload():
    if "audio" not in request.files:
        return jsonify(error="No audio file"), 400

    language = request.form.get("language")
    audio_file = request.files["audio"]

    with tempfile.NamedTemporaryFile(delete=False, suffix=".tmp") as tmp:
        audio_file.save(tmp.name)
        path = tmp.name
    try:
        with open(path, "rb") as f:
            params = {"model": "gpt-4o-mini-transcribe", "file": f}
            if language == "en":
                params["language"] = "en"
            elif language == "bn":
                params["language"] = "bn"

            transcript = client.audio.transcriptions.create(**params)
            raw_text = transcript.text
            summary, keyPoints = summarize_with_gpt_mini(raw_text)
            corrected_text = fix_spelling(transcript.text)
        return jsonify(
                transcription=corrected_text,
                summary=summary,
                keyPoints=keyPoints
            )            
        
        #return jsonify(transcription=transcript.text)
    

    except Exception as e:
        return jsonify(error=str(e)), 500
    finally:
        os.remove(path)

if __name__ == "__main__":
    app.run(debug=True)
