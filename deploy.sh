#!/bin/bash

# Stop on error
set -e

echo "🚀 Starting deployment..."

# 1. Pull latest changes
echo "📥 Pulling latest code..."
git pull

# 2. Build and restart all services
echo "🏗️ Building and restarting all services..."
docker compose up --build -d

# 3. Cleanup
echo "🧹 Cleaning up old images..."
docker image prune -f

echo "✅ Deployment complete!"
echo "📍 App Suite: http://localhost"
echo "📍 QR Backend: http://localhost:5005"
