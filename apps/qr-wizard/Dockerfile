FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY requirements.txt ./
RUN pip install --upgrade pip && pip install -r requirements.txt

COPY . .

RUN mkdir -p /app/data

ENV DATABASE_URL=sqlite:////app/data/qr_tracker.db \
    IP_HASH_SALT=change-me \
    UNIQUE_WINDOW_HOURS=24 \
    DATA_RETENTION_DAYS=365 \
    TRACKING_PARAM=qr_tid

EXPOSE 5000

CMD ["gunicorn", "-b", "0.0.0.0:5000", "-w", "2", "app:app"]
