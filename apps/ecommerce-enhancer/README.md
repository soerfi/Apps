# E-Commerce Image Enhancement Tool

Full-stack web application for automated product image enhancement using "Nano Banana Pro" API (Gemini 3).

## Features
- **Color Guardian™**: Ensures product color fidelity using Hex extraction and verification.
- **Async Processing**: Celery + Redis backend for non-blocking image generation.
- **Dockerized**: specific `docker-compose` setup for local development.
- **Modern UI**: React + Vite + TailwindCSS.

## Architecture
- **Frontend**: React, Vite, TailwindCSS (Port 3000)
- **Backend**: Python Flask (Port 5001)
- **Worker**: Celery Worker
- **Broker**: Redis (Port 6379)

## Setup & Running

### Prerequisites
- Docker & Docker Compose
- API Key for Nano Banana Pro (set in `docker-compose.yml`)

### Steps
1. Navigate to the project directory:
   ```bash
   cd apps/ecommerce-enhancer
   ```

2. Start the application:
   ```bash
   docker-compose up --build
   ```

3. Open your browser:
   - Frontend: [http://localhost:3000](http://localhost:3000)
   - Backend API: [http://localhost:5001](http://localhost:5001)

## Development
- **Backend Code**: `backend/`
- **Frontend Code**: `frontend/`
- **Services**:
  - `backend/services/color_guardian.py`: Logic for color consistency.
  - `backend/services/nano_banana.py`: API integration.

## License
Proprietary
