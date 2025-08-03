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
db = mysql.connector.connect(
    host=os.getenv("MYSQL_HOST"),
    user=os.getenv("MYSQL_USER"),
    password=os.getenv("MYSQL_PASSWORD"),
    database=os.getenv("MYSQL_DATABASE"),
    port=int(os.getenv("MYSQL_PORT", 3306))
)

cursor = db.cursor(dictionary=True)
DEFAULT_CURRENCY = int(os.getenv("DEFAULT_CURRENCY", 100))

#--------------- End of Database connection setup ---------------

#--------------- User login and creation ---------------
@app.route("/login_user", methods=["POST"])
def login_user():

    data = request.json
    email = data.get("email")
    name = data.get("name")

    if not email :
        return jsonify({"error": "No email provided"}), 400

    try:
        cursor.execute(
            "SELECT * FROM users WHERE email = %s", (email,))
        user = cursor.fetchone()

        if not user:
            # User not found, create a new user
            cursor.execute(
                "INSERT INTO users (email, name, currency) VALUES (%s, %s, %s)",
                (email,name, DEFAULT_CURRENCY)
            )
            db.commit()
            user_id = cursor.lastrowid
            user = cursor.fetchone()
        return jsonify(user)
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

#--------------- End of user login and creation ---------------

#--------------- Update user currency ---------------
@app.route("/update_currency", methods=["POST"])
def update_currency():
    data = request.json
    email = data.get("email")
    new_currency = data.get("currency")

    if not email :
        return jsonify({"error": "Missing email"}), 400

    elif new_currency is None:
        return jsonify({"error": "Missing Currency"}), 400
    
    
    try:
        cursor.execute(
            "UPDATE users SET currency = %s WHERE email = %s",
            (new_currency, email)
        )
        db.commit()

        return jsonify({"message": "Currency updated successfully"}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
#--------------- End of update user currency ---------------


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
        "in few lines Summarize the transcription of the audio and give key points in Bengali \n\n"
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
                "file": f,
                "prompt": "You are a transcription engine. Transcribe this audio word-for-word, without skipping or summarizing anything, even if it sounds repetitive or unimportant. Use Bangla script where applicable."

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
