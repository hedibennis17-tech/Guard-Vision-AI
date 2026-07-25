FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 libglib2.0-0 libsm6 libxext6 libxrender1 libgomp1 \
    tesseract-ocr libzbar0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt && \
    pip uninstall opencv-python opencv-contrib-python -y || true && \
    pip install --no-cache-dir opencv-python-headless --force-reinstall

COPY . .
RUN mkdir -p models logs

ENV QT_QPA_PLATFORM=offscreen
ENV MPLBACKEND=Agg
ENV DISPLAY=""
ENV PORT=8000

# IMPORTANT: exec form + shell pour que $PORT de Railway soit utilisé
CMD ["sh", "-c", "exec uvicorn main:app --host 0.0.0.0 --port ${PORT}"]
