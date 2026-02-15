#!/bin/bash

# --- Global Remote Deployment Script ---
# Run this from your local machine to push changes to your server.

# === CONFIGURATION ===
# PLEASE UPDATE THESE VALUES:
SERVER_USER="server"
SERVER_IP="72.62.43.134"
SERVER_PATH="/home/server/app"
# ======================

echo "🚀 Preparing for remote deployment..."

# 1. Verification
if [[ "$SERVER_IP" == "your-server-ip-here" ]]; then
    echo "❌ Error: Please edit remote-deploy.sh and set your SERVER_IP and SERVER_USER."
    exit 1
fi

echo "📦 Syncing files to server ($SERVER_IP)..."

# 2. Sync files using rsync 
# This will try to create the folder if it doesn't exist
rsync -avz --delete --rsync-path="mkdir -p ${SERVER_PATH} && rsync" \
    --exclude 'node_modules' \
    --exclude '.venv' \
    --exclude '.git' \
    --exclude '.agent' \
    --exclude 'data' \
    --exclude 'dist' \
    ./ ${SERVER_USER}@${SERVER_IP}:${SERVER_PATH}

echo "🏗️  Executing build and restart on server..."

# 3. Use SSH to run docker-compose
ssh ${SERVER_USER}@${SERVER_IP} << EOF
    cd ${SERVER_PATH}
    
    echo "Stopping any existing standalone containers..."
    docker stop my-app-menu qr-code-analytics || true
    docker rm my-app-menu qr-code-analytics || true

    echo "Building and starting services with Docker Compose..."
    docker compose down || true
    docker compose up --build -d
    
    echo "Pruning unused resources..."
    docker image prune -f
    
    echo "Service Status:"
    docker compose ps
EOF

echo "----------------------------------------------------"
echo "🎉 Deployment initiated!"
echo "📍 Dashboard: http://${SERVER_IP}"
echo "📍 QR Wizard: http://${SERVER_IP}/qr-wizard"
echo "📍 QR Tracking: http://${SERVER_IP}/t/slug"
echo "----------------------------------------------------"
