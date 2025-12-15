FROM python:3.9-slim

WORKDIR /app




COPY requirements.txt .
RUN pip install --upgrade pip --no-input --progress-bar off && \
    pip install --no-cache-dir --no-input --progress-bar off -r requirements.txt

COPY . .


CMD ["flask", "run", "--host=0.0.0.0", "--without-threads"]
