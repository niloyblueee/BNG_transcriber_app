# ---------- Stage 1: Build the Vite app ----------
FROM node:20-alpine AS build

# Set working dir
WORKDIR /app

# Copy package manifests first (cache speed-up)
COPY frontend/package*.json ./
# If you use pnpm or yarn, adjust accordingly (copy lockfile etc.)

# Install dependencies (use npm ci if package-lock.json exists for reproducible installs)
RUN npm ci

# Copy source
COPY frontend/. .

# Build-time args for Vite environment variables (prefix with VITE_)
# Example: --build-arg VITE_API_URL=https://api.example.com
ARG VITE_API_URL
ARG VITE_GOOGLE_CLIENT_ID
# Export them as ENV so the build step (vite) can read them via import.meta.env
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_GOOGLE_CLIENT_ID=${VITE_GOOGLE_CLIENT_ID}

# Build the production bundle (Vite outputs to /dist by default)
RUN npm run build


# ---------- Stage 2: Serve with nginx ----------
FROM nginx:stable-alpine

# Remove default nginx index if you want (optional)
# COPY nginx.conf will overwrite default server config

# Copy built static files from build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Optional: copy a custom nginx config to handle client-side routing (see below)
# If you don't copy a custom config, the default nginx config will serve files,
# but client-side routing (e.g. /dashboard on refresh) may 404.
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf


# Expose port 80 (Railway / hosting platforms use this to route HTTP)
EXPOSE 80

# Run nginx in foreground
CMD ["nginx", "-g", "daemon off;"]
