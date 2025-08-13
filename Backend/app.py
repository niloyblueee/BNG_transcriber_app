import os
from flask import Flask, request, jsonify, send_from_directory
from pathlib import Path
import tempfile
from flask import Flask, request, jsonify, render_template_string
from dotenv import load_dotenv
from itertools import zip_longest
import re
from openai import OpenAI
from flask_cors import CORS
import mysql.connector
import math

# Re-added the requests import
import requests as pyrequests 
from mutagen.mp3 import MP3
from mutagen.mp4 import MP4
from mutagen.wave import WAVE
from mutagen.oggvorbis import OggVorbis


# pip install pydub requests
# make sure ffmpeg is installed and on PATH
import os
import tempfile
import math
import difflib
from pydub import AudioSegment, silence
from pydub.utils import which
import requests
from flask import Flask, request, jsonify
from pydub import AudioSegment
import tempfile
import os
import math


app = Flask(__name__)

ELEVEN_STT = "https://api.elevenlabs.io/v1/speech-to-text"

load_dotenv()
client = OpenAI()

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
ELEVEN_API_KEY = os.getenv("ELEVEN_API_KEY")
if not ELEVEN_API_KEY:
    raise RuntimeError("ELEVEN_API_KEY is not set. Set the ELEVEN_API_KEY env var.")

AUDIO_EXTS = {".mp3", ".m4a", ".wav", ".webm", ".ogg"}
AUDIO_FOLDER = Path(__file__).parent

app = Flask(__name__, static_folder="dist", static_url_path="")
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)

AudioSegment.converter = which("ffmpeg")
print("pydub ffmpeg path:", AudioSegment.converter)


@app.route("/")
def serve_index():
    return send_from_directory(app.static_folder, "index.html")

@app.route("/<path:path>")
def serve_static(path):
    return send_from_directory(app.static_folder, path)

DEFAULT_FREE_SECONDS = int(os.getenv("DEFAULT_FREE_SECONDS", 30))

def split_on_silence_chunks(file_path, min_silence_len=700, silence_thresh=-40, keep_silence=300, max_chunk_len_ms=10*60*1000):
    """
    Splits audio on silence using pydub.split_on_silence but also ensures no chunk
    exceeds max_chunk_len_ms by further slicing if needed.
    - min_silence_len: ms of silence to consider as split point
    - silence_thresh: dBFS threshold (e.g. -40)
    - keep_silence: how much silence to keep at chunk edges (ms)
    - max_chunk_len_ms: max chunk size (ms) — safety.
    Returns list of AudioSegment objects.
    """
    audio = AudioSegment.from_file(file_path)
    # initial split by silence
    raw_chunks = silence.split_on_silence(
        audio,
        min_silence_len=min_silence_len,
        silence_thresh=silence_thresh,
        keep_silence=keep_silence
    )

    # ensure chunks aren't too large (split further if needed)
    final_chunks = []
    for ch in raw_chunks:
        if len(ch) <= max_chunk_len_ms:
            final_chunks.append(ch)
        else:
            # break into equal sized pieces with small overlap
            start = 0
            chunk_ms = max_chunk_len_ms
            overlap_ms = 500
            while start < len(ch):
                end = min(start + chunk_ms, len(ch))
                piece = ch[start:end]
                final_chunks.append(piece)
                start = end - overlap_ms
    return final_chunks

def transcribe_chunk_with_eleven(audio_segment, filename="chunk.wav", language="bn", timeout=600):
    """Export the audio segment to a temp WAV and send to Eleven STT, return text"""
    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
        audio_segment.export(tmp.name, format="wav")
        tmp_path = tmp.name

    try:
        with open(tmp_path, "rb") as fh:
            headers = {
                "xi-api-key": ELEVEN_API_KEY,
                "Accept": "application/json"
            }
            data = {
                "model_id": "scribe_v1",
                "language_code": language,
                "diarize": False
            }
            files = {"file": (filename, fh, "audio/wav")}
            resp = requests.post(ELEVEN_STT, headers=headers, data=data, files=files, timeout=timeout)
            if resp.status_code >= 400:
                print("Eleven error:", resp.status_code, resp.text)
            resp.raise_for_status()
            j = resp.json()
            # prefer 'text' then 'transcript'
            return j.get("text") or j.get("transcript") or "", j
    finally:
        try:
            os.remove(tmp_path)
        except OSError:
            pass

def merge_texts_remove_overlap(a: str, b: str, max_overlap_words=40):
    """
    Join text a and b by detecting the largest overlap (in words) up to max_overlap_words.
    Returns merged string with duplication removed.
    """
    if not a:
        return b
    if not b:
        return a

    a_words = a.strip().split()
    b_words = b.strip().split()

    # limit search length
    max_ol = min(max_overlap_words, len(a_words), len(b_words))

    # find the largest k such that last k words of a == first k words of b
    best_k = 0
    for k in range(max_ol, 0, -1):
        if a_words[-k:] == b_words[:k]:
            best_k = k
            break

    if best_k > 0:
        merged = " ".join(a_words + b_words[best_k:])
        return merged

    # fallback: fuzzy matching using SequenceMatcher on strings (safer for minor punctuation differences)
    s = difflib.SequenceMatcher(None, a, b)
    match = s.find_longest_match(0, len(a), 0, len(b))
    # if matched substring is reasonably long, remove duplication
    if match.size > 20:  # characters
        overlap_in_a = a[match.a: match.a + match.size]
        # remove overlap in b start
        if b.startswith(overlap_in_a):
            return a + b[match.size:]
    # no overlap detected: simple join with space
    return a + " " + b


@app.route("/transcribe_smart_chunk", methods=["POST"])
def transcribe_smart_chunk():
    email = request.form.get("email")
    name = request.form.get("name", "")
    uploaded_file = request.files.get("file")

    if not uploaded_file:
        return jsonify(error="No file uploaded"), 400
    if not email:
        return jsonify(error="No email provided"), 400

    suffix = Path(uploaded_file.filename).suffix
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    try:
        uploaded_file.save(tmp.name)
        tmp.close()

        if suffix.lower() not in AUDIO_EXTS:
            return jsonify(error="Unsupported file type"), 415

        user = get_user_from_db(email, name)
        audio_duration = get_audio_duration(tmp.name)
        if audio_duration is None:
            return jsonify(error="Could not determine audio duration"), 500

        seconds_needed = math.ceil(audio_duration)
        if user["free_seconds"] < seconds_needed:
            return jsonify(
                transcription=None,
                summary=None,
                keyPoints=None,
                error=f"Not enough free seconds. You have {user['free_seconds']} seconds left, but the audio is {seconds_needed} seconds long.",
                free_seconds_left=user["free_seconds"]
            ), 402

        # Deduct user seconds early
        new_balance = user["free_seconds"] - seconds_needed
        update_user_free_seconds(user["id"], new_balance)

        # Load full audio with pydub
        audio = AudioSegment.from_file(tmp.name)

        # ----------------- CHUNK SIZE ADJUSTED -----------------
        # Changed to 75 seconds per chunk (75 * 1000 ms) to avoid ElevenLabs ~79s cutoff
        chunk_length_ms = 75 * 1000  # 75 seconds per chunk (adjust as needed)
        # -------------------------------------------------------

        chunks = [audio[i:i+chunk_length_ms] for i in range(0, len(audio), chunk_length_ms)]
        print(f"🔍 Total audio length: {len(audio) / 1000:.2f} seconds")
        print(f"🔍 Chunk length target: {chunk_length_ms / 1000} seconds")
        print(f"🔍 Total chunks created: {len(chunks)}")

        for idx, chunk in enumerate(chunks):
            duration_sec = len(chunk) / 1000
            print(f"  - Chunk {idx + 1}: {duration_sec:.2f} seconds")


        full_transcript = ""

        for i, chunk_audio in enumerate(chunks):
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as chunk_file:
                # Export chunk with safe logic
                ext = suffix.replace('.', '')
                if ext == "m4a":
                    # export as mp4 container with AAC codec
                    chunk_audio.export(chunk_file.name, format="mp4", codec="aac")
                elif ext in {"mp3", "wav", "ogg", "flac"}:
                    chunk_audio.export(chunk_file.name, format=ext)
                else:
                    chunk_audio.export(chunk_file.name, format="wav")  # fallback
                
                chunk_file.close()

                headers = {"xi-api-key": os.getenv("ELEVEN_API_KEY")}
                files = {"file": (uploaded_file.filename, open(chunk_file.name, "rb"), uploaded_file.mimetype)}
                data = {"model_id": "scribe_v1"}

                response = pyrequests.post(
                    "https://api.elevenlabs.io/v1/speech-to-text",
                    headers=headers,
                    data=data,
                    files=files,
                    timeout=600,
                )
                response.raise_for_status()
                body = response.json()
                chunk_text = body.get("text") or body.get("transcript") or ""

                full_transcript += chunk_text + " "

                try:
                    os.unlink(chunk_file.name)
                except OSError:
                    pass

        full_transcript = full_transcript.strip()
        if not full_transcript:
            return jsonify(error="Transcription failed or empty", free_seconds_left=new_balance), 500

        update_user_free_seconds(user["id"], new_balance)
        summary, keyPoints = summarize_with_gpt_mini(full_transcript)
        #corrected = fix_spelling(full_transcript)

        return jsonify(
            #transcription=corrected,
            transcription = full_transcript,
            summary=summary,
            keyPoints=keyPoints,
            free_seconds_left=new_balance,
        )
    except Exception as e:
        print(f"Transcription error: {e}")
        return jsonify(error=str(e)), 500
    finally:
        try:
            os.unlink(tmp.name)
        except OSError:
            pass

        
def get_db_connection():
    return mysql.connector.connect(
        host=os.getenv("MYSQL_HOST"),
        user=os.getenv("MYSQL_USER"),
        password=os.getenv("MYSQL_PASSWORD"),
        database=os.getenv("MYSQL_DATABASE"),
        port=int(os.getenv("MYSQL_PORT", 3306))
    )

def get_user_from_db(email, name=None):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT * FROM users WHERE email = %s", (email,))
        user = cursor.fetchone()
        if not user:
            cursor.execute(
                "INSERT INTO users (email, name, free_seconds) VALUES (%s, %s, %s)",
                (email, name, DEFAULT_FREE_SECONDS)
            )
            conn.commit()
            cursor.execute("SELECT * FROM users WHERE email = %s", (email,))
            user = cursor.fetchone()
        return user
    finally:
        cursor.close()
        conn.close()

def update_user_free_seconds(user_id, new_seconds_count):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("UPDATE users SET free_seconds = %s WHERE id = %s", (new_seconds_count, user_id))
        conn.commit()
    finally:
        cursor.close()
        conn.close()

ASCII_RE = re.compile(r'^[\x00-\x7F]+$')

def is_english_token(tok: str) -> bool:
    tok = tok.strip()
    return bool(tok) and ASCII_RE.fullmatch(tok)

def fix_spelling(transcription: str) -> str:
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
        return transcription

def summarize_with_gpt_mini(text: str) -> tuple[str, list[str]]:
    prompt = (
        "in few lines Summarize the transcription of the audio and give key points in the language of the transcription \n\n"
        f"টেক্সট:\n{text}"
    )
    resp = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {
                "role": "system",
                "content": "You are a helpful assistant that summarizes text."
            },
            {"role": "user", "content": prompt}
        ],
        temperature=0.3
    )
    out = resp.choices[0].message.content.strip()
    parts = out.split("\n", 1)
    summary = parts[0].strip()
    bullet_block = parts[1] if len(parts) > 1 else ""
    keyPoints = [
        line.lstrip("–- ").strip()
        for line in bullet_block.splitlines()
        if line.strip()
    ]
    return summary, keyPoints

def get_audio_duration(file_path):
    try:
        ext = os.path.splitext(file_path)[1].lower()
        if ext == ".mp3":
            audio = MP3(file_path)
        elif ext == ".m4a":
            audio = MP4(file_path)
        elif ext == ".wav":
            audio = WAVE(file_path)
        elif ext == ".ogg":
            audio = OggVorbis(file_path)
        else:
            return None
        return audio.info.length
    except Exception as e:
        print(f"Error getting audio duration: {e}")
        return None

@app.route("/login_user", methods=["POST"])
def login_user():
    data = request.json
    email = data.get("email")
    name = data.get("name")
    if not email:
        return jsonify({"error": "No email provided"}), 400
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM users WHERE email = %s", (email,))
        user = cursor.fetchone()
        if not user:
            cursor.execute(
                "INSERT INTO users (email, name, free_seconds) VALUES (%s, %s, %s)",
                (email, name, DEFAULT_FREE_SECONDS)
            )
            conn.commit()
            cursor.execute("SELECT * FROM users WHERE email = %s", (email,))
            user = cursor.fetchone()
        cursor.close()
        conn.close()
        return jsonify({
            "email": user["email"],
            "name": user["name"],
            "free_seconds": user["free_seconds"]
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/update_currency", methods=["POST"])
def update_currency():
    data = request.json
    email = data.get("email")
    new_seconds = data.get("free_seconds")
    if not email:
        return jsonify({"error": "Missing email"}), 400
    elif new_seconds is None:
        return jsonify({"error": "Missing free_seconds"}), 400
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("UPDATE users SET free_seconds = %s WHERE email = %s", (new_seconds, email))
        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({"message": "Free seconds updated successfully"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/transcribe_local", methods=["POST"])
def transcribe_local():
    email = request.form.get("email")
    name = request.form.get("name", "")
    uploaded_file = request.files.get("file")

    if not uploaded_file:
        return jsonify(error="No file uploaded"), 400
    if not email:
        return jsonify(error="No email provided"), 400

    suffix = Path(uploaded_file.filename).suffix
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    try:
        uploaded_file.save(tmp.name)
        tmp.close()

        if suffix.lower() not in AUDIO_EXTS:
            return jsonify(error="Unsupported file type"), 415

        user = get_user_from_db(email, name)
        
        audio_duration = get_audio_duration(tmp.name)
        if audio_duration is None:
            return jsonify(error="Could not determine audio duration"), 500

        seconds_needed = math.ceil(audio_duration)

        if user["free_seconds"] < seconds_needed:
            return jsonify(
                transcription=None,
                summary=None,
                keyPoints=None,
                error=f"Not enough free seconds. You have {user['free_seconds']} seconds left, but the audio is {seconds_needed} seconds long.",
                free_seconds_left=user["free_seconds"]
            ), 402

        new_balance = user["free_seconds"] - seconds_needed
        update_user_free_seconds(user["id"], new_balance)  
        raw_text = ""

        # Correctly open file and make API call with model_id as a query parameter
        with open(tmp.name, "rb") as audio_file_object:
            headers = {
                "xi-api-key": os.getenv("ELEVEN_API_KEY")
            }
            files = {
                "file": (uploaded_file.filename, audio_file_object, uploaded_file.mimetype),
            }
            # The model_id parameter must be in the URL, not the data payload
            data  = {
                "model_id": "scribe_v1",
            }
            
            response = pyrequests.post(
                'https://api.elevenlabs.io/v1/speech-to-text',
                headers=headers,
                data=data,
                files=files,
                timeout=600,
            )
            try:
                response.raise_for_status()

            except pyrequests.HTTPError as e:
                print("ElevenLabs error response:", response.status_code, response.text)
                raise    

            body = response.json()
            raw_text = body.get("text") or body.get("transcript") or ""

        if not raw_text:
            return jsonify(error="Transcription failed or empty",
                           free_seconds_left=new_balance), 500
        
        summary, keyPoints = summarize_with_gpt_mini(raw_text)
        corrected = fix_spelling(raw_text)

        return jsonify(
            transcription=corrected,
            summary=summary,
            keyPoints=keyPoints,
            free_seconds_left=new_balance
        )
    except Exception as e:
        print(f"Transcription error: {e}")
        return jsonify(error=str(e)), 500
    finally:
        try:
            os.unlink(tmp.name)
        except OSError:
            pass


@app.route("/transcribe", methods=["POST"])
def transcribe_upload():
    if "audio" not in request.files:
        return jsonify(error="No audio file"), 400
    audio_file = request.files["audio"]
    email = request.form.get("email")
    name = request.form.get("name", "")
    if not email:
        return jsonify(error="No email provided"), 400

    with tempfile.NamedTemporaryFile(delete=False, suffix=".tmp") as tmp:
        audio_file.save(tmp.name)
        path = tmp.name
    try:
        user = get_user_from_db(email, name)
        audio_duration = get_audio_duration(path)
        if audio_duration is None:
            return jsonify(error="Could not determine audio duration"), 500
        seconds_needed = math.ceil(audio_duration)
        if user["free_seconds"] < seconds_needed:
            return jsonify(
                transcription=None,
                summary=None,
                keyPoints=None,
                error=f"Not enough free seconds. You have {user['free_seconds']} seconds left, but the audio is {seconds_needed} seconds long.",
                free_seconds_left=user["free_seconds"]
            ), 402

        new_balance = user["free_seconds"] - seconds_needed
        update_user_free_seconds(user["id"], new_balance)

        raw_text = ""
        with open(path, "rb") as audio_file_object:
            headers = {
                "xi-api-key": os.getenv("ELEVEN_API_KEY")
            }
            files = {
                "audio_file": (audio_file.filename, audio_file_object, audio_file.mimetype),
            }
            params = {
                "model_id": "scribe_v1",
            }
            response = pyrequests.post(
                'https://api.elevenlabs.io/v1/speech-to-text',
                headers=headers,
                params=params,
                files=files,
            )
            response.raise_for_status()
            raw_text = response.json().get("transcript", "").strip()

        if not raw_text:
            return jsonify(error="Transcription failed, no text generated",
                           free_seconds_left=new_balance), 500

        summary, keyPoints = summarize_with_gpt_mini(raw_text)
        corrected_text = fix_spelling(raw_text)

        return jsonify(
            transcription=corrected_text,
            summary=summary,
            keyPoints=keyPoints,
            free_seconds_left=new_balance
        )
    except Exception as e:
        print(f"Transcription error: {e}")
        return jsonify(error=str(e)), 500
    finally:
        os.remove(path)

if __name__ == "__main__":
    app.run(debug=True)