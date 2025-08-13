#!/bin/bash
set -e

echo "== start.sh: begin =="
uname -a
echo "Path: $PWD"

# install ffmpeg (if you keep it here)
apt-get update && apt-get install -y ffmpeg

echo "ffmpeg -> $(which ffmpeg || echo 'not found')"
ffmpeg -version | head -n 1 || true

# ensure python deps (optional)
python -m pip install --upgrade pip setuptools wheel
if [ -f requirements.txt ]; then
  echo "Installing Python requirements..."
  pip install --no-cache-dir -r requirements.txt
fi

# Use PORT env var from Railway (fallback to 5000 locally)
PORT=${PORT:-5000}
echo "Starting gunicorn on 0.0.0.0:${PORT}"
exec gunicorn Backend.app:app --bind 0.0.0.0:${PORT} --workers 1
