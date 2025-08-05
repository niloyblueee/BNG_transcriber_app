import os
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

#from google.oauth2 import id_token
#from google.auth.transport import requests as grequests
#from google_auth_oauthlib.flow import Flow
#from google.auth.transport import requests
#import requests as pyrequests 


load_dotenv()                               # reads .env
client = OpenAI()                           # auto‑reads OPENAI_API_KEY

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")

AUDIO_EXTS = {".mp3", ".m4a", ".wav", ".webm", ".ogg"}
AUDIO_FOLDER = Path(__file__).parent        # folder containing app.py


app = Flask(__name__)

CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)

#--------------- Database connection setup ---------------
# Ensure you have the required environment variables set
def get_db_connection():
    
    """Create a database connection using environment variables."""

    return mysql.connector.connect(
        host=os.getenv("MYSQL_HOST"),
        user=os.getenv("MYSQL_USER"),
        password=os.getenv("MYSQL_PASSWORD"),
        database=os.getenv("MYSQL_DATABASE"),
        port=int(os.getenv("MYSQL_PORT", 3306))
    )

DEFAULT_TOKENS = int(os.getenv("DEFAULT_TOKENS", 100))
TOKENS_PER_1000_WORDS = 200  # cost setting (adjust as needed)

#  ---------- User utilities ----------
def get_user_from_db(email, name=None):
    """Fetch user by email; create with default tokens if not exists."""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT * FROM users WHERE email = %s", (email,))
        user = cursor.fetchone()

        if not user:
            cursor.execute(
                "INSERT INTO users (email, name, tokens) VALUES (%s, %s, %s)",
                (email, name, DEFAULT_TOKENS)
            )
            conn.commit()
            cursor.execute("SELECT * FROM users WHERE email = %s", (email,))
            user = cursor.fetchone()
        return user
    finally:
        cursor.close()
        conn.close()

def update_user_tokens(user_id, new_token_count):
    """Update user’s token balance."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("UPDATE users SET tokens = %s WHERE id = %s", (new_token_count, user_id))
        conn.commit()
    finally:
        cursor.close()
        conn.close()


#--------------- End of Database connection setup ---------------


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
        "in few lines Summarize the transcription of the audio and give key points in the language of the transcription \n\n"
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




#--------------- User login and creation ---------------
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
                "INSERT INTO users (email, name, tokens) VALUES (%s, %s, %s)",
                (email, name, DEFAULT_TOKENS)
            )
            conn.commit()

            cursor.execute("SELECT * FROM users WHERE email = %s", (email,))
            user = cursor.fetchone()

        cursor.close()
        conn.close()

        return jsonify({
            "email": user["email"],
            "name": user["name"],
            "tokens": user["tokens"]
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
#--------------- End of user login and creation ---------------

#--------------- Update user currency ---------------
@app.route("/update_currency", methods=["POST"])
def update_currency():
    data = request.json
    email = data.get("email")
    new_tokens = data.get("tokens")

    if not email :
        return jsonify({"error": "Missing email"}), 400

    elif new_tokens is None:
        return jsonify({"error": "Missing tokens"}), 400
    
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("UPDATE users SET tokens = %s WHERE email = %s", (new_tokens, email))
        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({"message": "Tokens updated successfully"}), 200
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
#--------------- End of update user currency ---------------


# ---------- transcribe local file ----------

@app.route("/transcribe_local", methods=["POST"])
def transcribe_local():
    # 1) Read multipart form fields
    email = request.form.get("email")
    name = request.form.get("name", "")
    language = request.form.get("language", "bn")
    uploaded_file = request.files.get("file")

    if not uploaded_file:
        return jsonify(error="No file uploaded"), 400
    if not email:
        return jsonify(error="No email provided"), 400

    # 2) Save to a NamedTemporaryFile (avoids Windows locking)
    suffix = Path(uploaded_file.filename).suffix
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    try:
        uploaded_file.save(tmp.name)
        tmp.close()

        # 3) Validate extension
        if suffix.lower() not in AUDIO_EXTS:
            return jsonify(error="Unsupported file type"), 415

        # 4) Fetch or create user, check tokens
        user = get_user_from_db(email, name)
        raw_trans = client.audio.transcriptions.create(
            model="gpt-4o-mini-transcribe",
            file=open(tmp.name, "rb"),
            prompt="You are a transcription engine. Transcribe word-for-word...",
            **({"language": language} if language in ("en","bn") else {})
        )
        raw_text = raw_trans.text.strip()

        if not raw_text:
            return jsonify(error="Transcription failed or empty",
                           tokens_left=user["tokens"]), 500
        

        word_count = len(raw_text.split())
        tokens_needed = math.ceil(word_count / 1000) * TOKENS_PER_1000_WORDS

        if user["tokens"] < tokens_needed:
            return jsonify(
                transcription=None,
                summary=None,
                keyPoints=None,
                error="Not enough tokens. Please buy more.",
                tokens_left=user["tokens"]
            ), 402

        # 5) Deduct tokens & post-process
        new_balance = user["tokens"] - tokens_needed
        update_user_tokens(user["id"], new_balance)

        # 6) Summarize and fix spelling
        summary, keyPoints = summarize_with_gpt_mini(raw_text)
        corrected = fix_spelling(raw_text)

        return jsonify(
            transcription=corrected,
            summary=summary,
            keyPoints=keyPoints,
            tokens_left=new_balance
        )

    except Exception as e:
        return jsonify(error=str(e)), 500

    finally:
        try:
            os.unlink(tmp.name)
        except OSError:
            pass

# ---------- fallback upload endpoint ----------
@app.route("/transcribe", methods=["POST"])
def transcribe_upload():
    if "audio" not in request.files:
        return jsonify(error="No audio file"), 400

    language = request.form.get("language")
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

        with open(path, "rb") as f:
            params = {"model": "gpt-4o-mini-transcribe", "file": f}
            if language == "en":
                params["language"] = "en"
            elif language == "bn":
                params["language"] = "bn"

            transcript = client.audio.transcriptions.create(**params)
            raw_text = transcript.text.strip()

        if not raw_text:
            return jsonify(error="Transcription failed, no text generated",
                           tokens_left=user["tokens"]), 500

        # Count words and calculate tokens
        word_count = len(raw_text.split())
        tokens_needed = math.ceil(word_count / 1000) * TOKENS_PER_1000_WORDS

        if user["tokens"] < tokens_needed:
            return jsonify(
                transcription=None,
                summary=None,
                keyPoints=None,
                error="Not enough tokens. Please buy more.",
                tokens_left=user["tokens"]
            ), 402

        # Deduct tokens only after success
        new_balance = user["tokens"] - tokens_needed
        update_user_tokens(user["id"], new_balance)

        summary, keyPoints = summarize_with_gpt_mini(raw_text)
        corrected_text = fix_spelling(raw_text)

        return jsonify(
            transcription=corrected_text,
            summary=summary,
            keyPoints=keyPoints,
            tokens_left=new_balance
        )

    except Exception as e:
        return jsonify(error=str(e)), 500
    finally:
        os.remove(path)

"""
#verify the google token for signin 

CLIENT_SECRETS_FILE = Path(__file__).parent / "client_secret.json"
REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "postmessage")  

@app.route("/verify_google_token", methods=["POST"])
def verify_google_token():
    try:
        code = request.json.get("code")
        if not code:
            return jsonify({"error": "No code provided"}), 400

        # Exchange the authorization code for tokens
        token_url = "https://oauth2.googleapis.com/token"
        token_data = {
            "code": code,
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "redirect_uri": REDIRECT_URI,
            "grant_type": "authorization_code",
        }

        token_res = pyrequests.post(token_url, data=token_data)
        if token_res.status_code != 200:
            return jsonify({"error": "Token exchange failed", "details": token_res.json()}), 400

        tokens = token_res.json()
        idinfo = id_token.verify_oauth2_token(
            tokens["id_token"],
            grequests.Request(),
            GOOGLE_CLIENT_ID
        )

        # Extract user info
        user = {
            "id": idinfo["sub"],
            "email": idinfo.get("email"),
            "name": idinfo.get("name"),
            "picture": idinfo.get("picture")
        }

        return jsonify({"message": "Token verified successfully", "user": user})

    except Exception as e:
        return jsonify({"error": "Invalid token exchange", "details": str(e)}), 401

"""

if __name__ == "__main__":
    app.run(debug=True)
