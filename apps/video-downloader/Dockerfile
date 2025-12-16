FROM python:3.9-slim

# Install system dependencies including ffmpeg
RUN apt-get update && apt-get install -y \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements first for caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create downloads directory
RUN mkdir -p downloads

# Expose port (internal)
EXPOSE 5001

# Run with Gunicorn
CMD ["gunicorn", "--bind", "0.0.0.0:5001", "app:app"]
