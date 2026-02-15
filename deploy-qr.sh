#!/zsh

# --- QR Analytics Deployment Script ---
# This script builds and starts the QR Analytics container.

# Configuration
CONTAINER_NAME="qr-code-analytics"
PORT=5005
IMAGE_NAME="qr-analytics"
DATA_DIR="$(pwd)/data"

# Ensure we are in the project root
if [[ ! -d "apps/qr-wizard" ]]; then
    echo "❌ Error: Please run this script from the Antigravity Projects root."
    exit 1
fi

echo "🚀 Starting Deployment for QR Analytics..."

# 1. Pull latest code (if in git)
if [ -d ".git" ]; then
    echo "📥 Pulling latest changes..."
    git pull
fi

# 2. Build the Docker image
echo "🏗️ Building Docker image..."
docker build -t $IMAGE_NAME "./apps/qr-wizard"

# 3. Stop and remove existing container
if [ "$(docker ps -aq -f name=$CONTAINER_NAME)" ]; then
    echo "🛑 Stopping existing container..."
    docker stop $CONTAINER_NAME
    docker rm $CONTAINER_NAME
fi

# 4. Create data directory if it doesn't exist
mkdir -p "$DATA_DIR"

# 5. Run the new container
echo "▶️ Starting new container on port $PORT..."
docker run -d \
    --name $CONTAINER_NAME \
    --restart unless-stopped \
    -p $PORT:5000 \
    -v "$DATA_DIR":/app/data \
    -e IP_HASH_SALT="secure-random-$(date +%s)" \
    -e PUBLIC_BASE_URL="http://$(hostname):$PORT" \
    $IMAGE_NAME

echo "----------------------------------------------------"
echo "✅ Deployment successful!"
echo "📍 Access the app at: http://localhost:$PORT"
echo "📂 Persisted data location: $DATA_DIR"
echo "----------------------------------------------------"
