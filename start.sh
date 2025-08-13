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

# start gunicorn (adjust module path if needed)
exec gunicorn Backend.app:app --bind 0.0.0.0:5000 --workers 1
