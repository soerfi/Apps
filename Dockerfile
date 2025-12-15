# Stage 1: Build everything
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files for root (if any) and apps
# We copy everything because our build script needs to see the whole structure
COPY . .

# Install root dependencies (if any, e.g. for the script if it used external libs, but it uses standard node libs)
# However, we need to install dependencies for the build script if we add any.
# Currently build-all.js uses child_process to run npm install in subfolders.
# So we just need to run the script.

# Make the script executable
RUN chmod +x scripts/build-all.js

# Run the build script
RUN node scripts/build-all.js

# Stage 2: Serve with Nginx + Python Backend
FROM python:3.11-slim

# Install Nginx and ffmpeg
RUN apt-get update && apt-get install -y nginx ffmpeg && rm -rf /var/lib/apt/lists/*

# Install Python dependencies for video-downloader
WORKDIR /app/video-downloader
COPY apps/video-downloader/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Create necessary directories
RUN mkdir -p /app/data && chmod 777 /app/data
RUN mkdir -p /app/video-downloader/downloads && chmod 777 /app/video-downloader/downloads

# Copy Video Downloader Code
WORKDIR /app/video-downloader
COPY apps/video-downloader/app.py .
COPY apps/video-downloader/templates/ ./templates/

# Copy Frontend Build
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy Nginx Config
# In Debian/Ubuntu nginx, conf.d is included by default in nginx.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf
# Remove default site if it exists
RUN rm -f /etc/nginx/sites-enabled/default

# Copy Start Script
COPY start.sh /start.sh
RUN chmod +x /start.sh

EXPOSE 80

CMD ["/start.sh"]
