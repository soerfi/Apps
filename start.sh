#!/bin/bash
set -e

# Start Video Downloader Backend
echo "Starting Video Downloader..."
cd /app/video-downloader
gunicorn --bind 0.0.0.0:5001 --workers 3 --timeout 300 app:app &

# Start Nginx
echo "Starting Nginx..."
nginx -g "daemon off;"
