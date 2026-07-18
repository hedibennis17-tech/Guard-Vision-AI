# Image ultralytics officielle — torch + YOLOv11 déjà installés
# Pas besoin de tout télécharger pendant le build
FROM ultralytics/ultralytics:latest-cpu

WORKDIR /app

# Seulement nos packages supplémentaires (légers)
COPY requirements.txt .
RUN pip install --no-cache-dir \
    fastapi==0.115.0 \
    "uvicorn[standard]==0.30.6" \
    python-multipart==0.0.9 \
    firebase-admin==6.5.0 \
    python-dotenv==1.0.1 \
    pydantic==2.8.2 \
    pydantic-settings==2.4.0 \
    loguru==0.7.2 \
    aiofiles==24.1.0 \
    httpx==0.27.2 \
    websockets==12.0

# Code
COPY . .
RUN mkdir -p models logs

EXPOSE 8000
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
