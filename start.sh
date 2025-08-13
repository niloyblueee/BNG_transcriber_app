#!/bin/bash
set -e

# Install ffmpeg
apt-get update && apt-get install -y ffmpeg

# Start Gunicorn
gunicorn Backend.app:app
