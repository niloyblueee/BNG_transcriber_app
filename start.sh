#!/bin/bash
set -e

# show where we are (debug)
echo "== start.sh: begin =="
uname -a
echo "Path: $PWD"

# install ffmpeg (non-interactive)
apt-get update && apt-get install -y ffmpeg

# show ffmpeg version found (quick check)
echo "ffmpeg -> $(which ffmpeg || echo 'not found')"
ffmpeg -version | head -n 1 || true

# Ensure pip and env are usable, then install requirements (safe - will skip if already satisfied)
python -m pip install --upgrade pip setuptools wheel
if [ -f requirements.txt ]; then
  echo "Installing Python requirements..."
  pip install --no-cache-dir -r requirements.txt
else
  echo "Warning: requirements.txt not found!"
fi


# start gunicorn (adjust module path if needed)
exec gunicorn Backend.app:app --bind 0.0.0.0:5000 --workers 1
