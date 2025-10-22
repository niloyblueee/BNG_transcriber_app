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
from urllib.parse import urlparse, unquote

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
import imageio_ffmpeg as ffmpeg
import json  # <-- added for keypoints serialization
from datetime import datetime  # <-- added for timestamps


app = Flask(__name__)

ELEVEN_STT = "https://api.elevenlabs.io/v1/speech-to-text"

load_dotenv()
client = OpenAI()

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
ELEVEN_API_KEY = os.getenv("ELEVEN_API_KEY")
if not ELEVEN_API_KEY:
    raise RuntimeError("ELEVEN_API_KEY is not set. Set the ELEVEN_API_KEY env var.")
print("Hello world")


AUDIO_EXTS = {".mp3", ".m4a", ".wav", ".webm", ".ogg", ".aac"}
AUDIO_FOLDER = Path(__file__).parent

app = Flask(__name__, static_folder="dist", static_url_path="")

allowed_origin = "https://branscriber.xyz"

CORS(
    app,
    resources={r"/*": {"origins": allowed_origin}},
    supports_credentials=True,
    methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Requested-With", "Accept"]
)

# Extra safety: ensure headers on every response (helps if proxy/redirects remove CORS)
@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = allowed_origin
    response.headers["Access-Control-Allow-Credentials"] = "true"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Requested-With, Accept"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
    return response
AudioSegment.converter = ffmpeg.get_ffmpeg_exe()
"""
@app.route("/")
def serve_index():
    return send_from_directory(app.static_folder, "index.html")

@app.route("/<path:path>")
def serve_static(path):
    return send_from_directory(app.static_folder, path)
"""

@app.route("/health", methods=["GET"])
def health():
    return {"status":"ok"}, 200

@app.route("/debug_eleven", methods=["POST"])
def debug_eleven():
    """
    Debug ElevenLabs request.
    Sends uploaded audio and prints what is being sent.
    """
    uploaded_file = request.files.get("file")
    if not uploaded_file:
        return jsonify({"error": "No file uploaded"}), 400

    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
        uploaded_file.save(tmp.name)
        tmp_path = tmp.name

    try:
        # Read file bytes
        with open(tmp_path, "rb") as fh:
            file_bytes = fh.read()

        headers = {
            "xi-api-key": ELEVEN_API_KEY,
            "Accept": "application/json"
        }
        data = {
            "model_id": "scribe_v1",
            "language_code": "bn",
            "diarize": False
        }
        files = {"file": ("debug.wav", file_bytes, "audio/wav")}

        # DEBUG: print some info
        print(f"Debug Eleven: file_size={len(file_bytes)} bytes")
        print(f"Headers: {headers}")
        print(f"Data: {data}")

        # Send request to ElevenLabs
        resp = requests.post(ELEVEN_STT, headers=headers, data=data, files=files, timeout=60)
        print(f"Status code: {resp.status_code}")
        print(f"Response: {resp.text}")

        return jsonify({
            "status_code": resp.status_code,
            "response_text": resp.text
        })
    except Exception as e:
        print(f"Debug Eleven Exception: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass

# Serve React app for all other routes
@app.route("/", defaults={"path": ""}, methods=["GET"])
@app.route("/<path:path>", methods=["GET"])
def serve(path):
    # Only serve the React app for browser/HTML GET requests.
    # Do NOT intercept API/JSON clients.
    accept = request.headers.get("Accept", "")
    # If the client prefers JSON (API calls) or path looks like an API, return 404 so Flask can match API routes.
    if path.startswith("api") or ("application/json" in accept and "text/html" not in accept):
        return jsonify({"error": "Not Found"}), 404

    file_path = os.path.join(app.static_folder, path)
    if path != "" and os.path.exists(file_path):
        return send_from_directory(app.static_folder, path)

    # Fallback to index.html for client-side routing
    return send_from_directory(app.static_folder, "index.html")
        



DEFAULT_FREE_SECONDS = int(os.getenv("DEFAULT_FREE_SECONDS", 300))

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
                data = {"model_id": "scribe_v1",
                        "diarize": True,
                        "tag_audio_events": True}

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
        summary = generate_summary_with_gpt_mini(full_transcript)
        keyPoints = generate_keypoints_with_gpt_mini(full_transcript)
        #corrected = fix_spelling(full_transcript)
        #UPDATE THE USER HISTORY
        add_user_history(email, full_transcript, summary, keyPoints)

        
        return jsonify(
            #transcription=corrected,
            transcription=full_transcript,
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

'''     
def get_db_connection():
    return mysql.connector.connect(
        host=os.getenv("MYSQL_HOST"),
        user=os.getenv("MYSQL_USER"),
        password=os.getenv("MYSQL_PASSWORD"),
        database=os.getenv("MYSQL_DATABASE"),
        port=int(os.getenv("MYSQL_PORT", 3306))
    )
'''
#egress  cost is fucking me 
def get_db_connection():
    """
    Connect using a single MYSQL_URL env var if provided (Railway internal URL).
    Otherwise fall back to older individual env vars for local development.
    Supports URLs like: mysql://user:pass@host:3306/dbname
    """
    mysql_url = os.getenv("MYSQL_URL") or os.getenv("DATABASE_URL")  # common alternates

    if mysql_url:
        # Parse URL form
        parsed = urlparse(mysql_url)
        # parsed.scheme should be 'mysql' (we ignore scheme beyond sanity)
        user = unquote(parsed.username) if parsed.username else os.getenv("MYSQL_USER")
        password = unquote(parsed.password) if parsed.password else os.getenv("MYSQL_PASSWORD")
        host = parsed.hostname or os.getenv("MYSQL_HOST", "127.0.0.1")
        port = parsed.port or int(os.getenv("MYSQL_PORT", 3306))
        # path usually like '/dbname' -> strip leading slash
        database = parsed.path.lstrip("/") if parsed.path else os.getenv("MYSQL_DATABASE")

        # Safety: final sanity check
        if not (user and password and host and database):
            raise RuntimeError(
                "Database URL found but missing components. "
                "Ensure MYSQL_URL contains user:pass@host:port/dbname or set individual env vars for local dev."
            )

        return mysql.connector.connect(
            host=host,
            user=user,
            password=password,
            database=database,
            port=int(port),
            connection_timeout=10
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

def get_user_history(email):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        # Prefer single aggregated row for the user
        cursor.execute("SELECT * FROM user_history WHERE email = %s LIMIT 1", (email,))
        row = cursor.fetchone()
        if not row:
            # backward compatibility: if there are multiple rows (older behavior), return them
            cursor.execute("SELECT * FROM user_history WHERE email = %s ORDER BY updated_at ASC", (email,))
            rows = cursor.fetchall()
            history = []
            for r in rows:
                kp = r.get("keypoints")
                try:
                    parsed_kp = json.loads(kp) if kp and isinstance(kp, str) else kp or []
                except Exception:
                    parsed_kp = kp.split(",") if isinstance(kp, str) else kp or []
                history.append({
                    "id": r.get("id"),
                    "email": r.get("email"),
                    "transcription": r.get("transcription"),
                    "summary": r.get("summary"),
                    "keypoints": parsed_kp,
                    "created_at": r.get("created_at"),
                })
            return history.reverse()

        # If row exists, try to interpret 'transcription' as aggregated JSON history
        stored = row.get("transcription")
        if isinstance(stored, str) and stored.startswith("["):
            try:
                entries = json.loads(stored)
                # ensure keypoints are lists
                for e in entries:
                    if isinstance(e.get("keypoints"), str):
                        try:
                            e["keypoints"] = json.loads(e["keypoints"])
                        except Exception:
                            e["keypoints"] = e["keypoints"].split(",") if e["keypoints"] else []
                return entries
            except Exception:
                # fall through to legacy parsing
                pass

        # Legacy single-row (not aggregated) -> return a single-entry history
        kp = row.get("keypoints")
        try:
            parsed_kp = json.loads(kp) if kp and isinstance(kp, str) else kp or []
        except Exception:
            parsed_kp = kp.split(",") if isinstance(kp, str) else kp or []

        return [{
            "id": row.get("id"),
            "email": row.get("email"),
            "transcription": row.get("transcription"),
            "summary": row.get("summary"),
            "keypoints": parsed_kp,
            "created_at": row.get("created_at"),
        }]
    finally:
        cursor.close()
        conn.close()

def add_user_history(email, transcription, summary, keypoints):
    """
    Append a new history entry into a single row per user.
    - If a user_history row exists for the email, try to parse an existing JSON array
      stored in `transcription` and append the new entry; otherwise convert legacy
      values into the array and update that row.
    - If no row exists, INSERT one with transcription field containing a JSON array.
    """
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT id, transcription, summary, keypoints, created_at FROM user_history WHERE email = %s LIMIT 1", (email,))
        row = cursor.fetchone()

        new_entry = {
            "transcription": transcription or "",
            "summary": summary or "",
            "keypoints": keypoints if isinstance(keypoints, (list, tuple)) else (json.loads(keypoints) if (isinstance(keypoints, str) and keypoints.startswith("[")) else (keypoints or [])),
            "created_at": datetime.utcnow().isoformat()
        }

        if row:
            stored = row.get("transcription")
            # Try parse as JSON array
            entries = None
            if isinstance(stored, str) and stored.strip().startswith("["):
                try:
                    entries = json.loads(stored)
                except Exception:
                    entries = None

            if entries is None:
                # Convert legacy single-row values into a list if there is any content
                legacy_entries = []
                if stored and stored.strip():
                    legacy_kp = row.get("keypoints")
                    try:
                        parsed_kp = json.loads(legacy_kp) if legacy_kp and isinstance(legacy_kp, str) and legacy_kp.strip().startswith("[") else (legacy_kp.split(",") if isinstance(legacy_kp, str) and legacy_kp else legacy_kp or [])
                    except Exception:
                        parsed_kp = legacy_kp.split(",") if isinstance(legacy_kp, str) and legacy_kp else legacy_kp or []
                    legacy_entries.append({
                        "transcription": stored,
                        "summary": row.get("summary") or "",
                        "keypoints": parsed_kp,
                        "created_at": row.get("created_at").isoformat() if isinstance(row.get("created_at"), (datetime,)) else (row.get("created_at") or "")
                    })
                entries = legacy_entries

            entries.append(new_entry)
            # store aggregated JSON in transcription field (keeps schema unchanged)
            cursor.execute(
                "UPDATE user_history SET transcription = %s, summary = %s, keypoints = %s, created_at = NOW() WHERE id = %s",
                (json.dumps(entries, ensure_ascii=False), summary or "", json.dumps(new_entry["keypoints"], ensure_ascii=False), row["id"])
            )
            conn.commit()
            return

        # no existing row -> insert one with transcription containing JSON array
        cursor.execute(
            "INSERT INTO user_history (email, transcription, summary, keypoints) VALUES (%s, %s, %s, %s)",
            (email, json.dumps([new_entry], ensure_ascii=False), summary or "", json.dumps(new_entry["keypoints"], ensure_ascii=False))
        )
        conn.commit()
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

def generate_summary_with_gpt_mini(text: str) -> str:
    prompt = (
        "Task: 1. Produce a single English summary paragraph (max 200 words) that covers the full content and includes every valid event/action mentioned.2. Preserve the chronological order of events.3. Do NOT invent events, claims, or details. If you infer something, label it as 'inferred' and give a low/medium confidence. Output only the English summary paragraph\n\n"
        f"text:\n{text}"
    )
    resp = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "You are a careful, conservative summarizer. The input is a transcription in any language. Produce a faithful English summary that captures all valid events in the transcript, preserves chronological order, and never invents facts. When text is unclear or inaudible, explicitly mark it as uncertain."},
            {"role": "user", "content": prompt}
        ],
        temperature=0.3
    )
    out = resp.choices[0].message.content.strip()
    return out


def generate_keypoints_with_gpt_mini(text: str) -> list[str]:
    prompt = (
        "Extract the key points from the following transcription and return them as bullet points in the language of the transcription.- Include every valid event that should appear as a keypoint; do not invent or omit important events.- Keep keypoints brief and independent (each point should be understandable alone).\n\n"
        f"text:\n{text}"
    )
    resp = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "You are a concise extractor of keypoints from a transcription in any language. Produce a short, ordered list of discrete keypoints in English that together cover the important facts, actions, and decisions from the transcript. Each keypoint must be grounded in the transcript; do not invent or combine unrelated events."},
            {"role": "user", "content": prompt}
        ],
        temperature=0.3
    )
    out = resp.choices[0].message.content.strip()
    keyPoints = [
        line.lstrip("–-•* ").strip()
        for line in out.splitlines()
        if line.strip()
    ]
    return keyPoints



def get_audio_duration(file_path):
    try:
        ext = os.path.splitext(file_path)[1].lower()
        if ext == ".mp3":
            audio = MP3(file_path)
            return audio.info.length
        elif ext == ".m4a":
            audio = MP4(file_path)
            return audio.info.length
        elif ext == ".wav":
            audio = WAVE(file_path)
            return audio.info.length
        elif ext == ".ogg":
            audio = OggVorbis(file_path)
            return audio.info.length
    
        # Fallback: use pydub (ffmpeg) which supports webm, mp4, many formats
        try:
            seg = AudioSegment.from_file(file_path)
            return len(seg) / 1000.0
        except Exception as pydub_e:
            print(f"pydub fallback failed for {file_path}: {pydub_e}")

        return None

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
        
        summary = generate_summary_with_gpt_mini(raw_text) 
        keyPoints = generate_keypoints_with_gpt_mini(raw_text)


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

        summary = generate_summary_with_gpt_mini(raw_text) 
        keyPoints = generate_keypoints_with_gpt_mini(raw_text)
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

@app.route("/railway_debug", methods=["GET"])
def railway_debug():
    import requests, os
    from io import BytesIO

    key = os.getenv("ELEVEN_API_KEY")
    # show repr so we can see hidden chars
    print("ELEVEN_API_KEY repr:", repr(key))
    # quick small WAV payload (silence) - or create small bytes to test
    dummy_bytes = BytesIO(b"RIFF....WAVEfmt ")  # small stub; httpbin will accept

    headers = {"xi-api-key": key, "Accept": "application/json"}
    files = {
        "file": ("debug.wav", dummy_bytes.getvalue(), "audio/wav"),
        "model_id": (None, "scribe_v1"),   # ensure multipart form-data includes model_id
    }

    out = {}

    try:
        # 1) echo via httpbin so we can inspect what actually left the container
        hb = requests.post("https://httpbin.org/anything", headers=headers, files=files, timeout=15)
        out["httpbin_status"] = hb.status_code
        out["httpbin_json"] = hb.json() if hb.status_code < 500 else hb.text
    except Exception as e:
        out["httpbin_error"] = str(e)

    try:
        # 2) real call to ElevenLabs
        el = requests.post("https://api.elevenlabs.io/v1/speech-to-text", headers=headers, files=files, timeout=15)
        out["eleven_status"] = el.status_code
        out["eleven_text"] = el.text[:2000]  # cap the response
    except Exception as e:
        out["eleven_error"] = str(e)

    return out

# New endpoint to fetch user history by email
@app.route("/get_history", methods=["POST"])
def get_history():
    data = request.get_json() or request.form or {}
    email = data.get("email")
    if not email:
        return jsonify({"error": "No email provided"}), 400
    try:
        history = get_user_history(email)
        return jsonify({"history": history}), 200
    except Exception as e:
        print("Error fetching history:", e)
        return jsonify({"error": str(e)}), 500


TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID")
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")

def send_telegram_message(message):
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {
        "chat_id": TELEGRAM_CHAT_ID,
        "text": message,
        "parse_mode": "HTML"
    }

    response = requests.post(url, json=payload)
    return response.json()

@app.route("/send_button_click", methods=["POST"])
def send_button_click():
    data = request.json
    n1 = data.get('SenderBkashNumber')
    n2 = data.get('SenderBkashTxnID')

    # Compose message
    message = f"*Button Clicked!*\nNumber1: {n1}\nNumber2: {n2}"

    # Send Telegram notification
    result = send_telegram_message(message)

    return jsonify({'status': 'ok', 'telegram': result})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)