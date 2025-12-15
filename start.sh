#!/bin/bash
set -e

# Start Video Downloader Backend
echo "Starting Video Downloader..."
cd /app/video-downloader
gunicorn --bind 0.0.0.0:5001 --workers 3 --timeout 300 app:app &

# Start Main Backend
echo "Starting Main Backend..."
cd /app/backend
uvicorn main:app --host 0.0.0.0 --port 8000 &

# Start Nginx
echo "Starting Nginx..."
nginx -g "daemon off;"
