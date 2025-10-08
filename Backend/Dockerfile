# ---------- Base image ----------
FROM python:3.11-slim AS base

# Prevents Python from writing .pyc files and buffers logs
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# ---------- Working directory ----------
WORKDIR /app

# ---------- Install OS deps (ffmpeg) ----------
# keep lists cleaned up to reduce image size
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg && \
    rm -rf /var/lib/apt/lists/*

# ---------- Install dependencies ----------
# Copy only requirements first to leverage Docker caching
COPY Backend/requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# ---------- Copy the rest of the app ----------
COPY Backend/. .

# ---------- Expose backend port ----------
EXPOSE 5000

# ---------- Environment variables ----------
# You can override these in Railway dashboard
ENV FLASK_ENV=production
ENV PORT=5000

# ---------- Run command ----------
CMD ["gunicorn", "--workers", "4", "--timeout", "600", "--bind", "0.0.0.0:5000", "app:app"]

