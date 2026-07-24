FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 libglib2.0-0 libsm6 libxext6 libxrender1 libgomp1 \
    tesseract-ocr tesseract-ocr-fra libzbar0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt && \
    pip uninstall opencv-python opencv-contrib-python -y -q || true && \
    pip install --no-cache-dir opencv-python-headless --force-reinstall -q

COPY . .
RUN mkdir -p models logs

ENV QT_QPA_PLATFORM=offscreen
ENV MPLBACKEND=Agg
ENV DISPLAY=""

CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
