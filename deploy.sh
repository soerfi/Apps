#!/bin/bash

# Stop on error
set -e

echo "🚀 Starting deployment..."

# 1. Pull latest changes
echo "📥 Pulling latest code..."
git pull

# 2. Build and Run with Docker Compose
echo "🚀 Starting Docker Compose..."
docker-compose down
docker-compose up -d --build --remove-orphans

echo "✅ Deployment complete! Services are running."
