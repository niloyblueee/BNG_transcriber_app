# ---------- Base image ----------
FROM python:3.11-slim AS base

# Prevents Python from writing .pyc files and buffers logs
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# ---------- Working directory ----------
WORKDIR /app

# ---------- Install dependencies ----------
# Copy only requirements first to leverage Docker caching
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# ---------- Copy the rest of the app ----------
COPY . .

# ---------- Expose backend port ----------
EXPOSE 5000

# ---------- Environment variables ----------
# You can override these in Railway dashboard
ENV FLASK_ENV=production
ENV PORT=5000

# ---------- Run command ----------
# Railway automatically injects PORT, so use it dynamically
CMD ["sh", "-c", "flask run --host=0.0.0.0 --port=${PORT}"]
