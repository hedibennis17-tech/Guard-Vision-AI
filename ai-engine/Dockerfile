FROM python:3.11-slim

# Dépendances système pour OpenCV + FFmpeg
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Installer les dépendances Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copier le code
COPY . .

# Créer le dossier des modèles (YOLOv11 téléchargé au premier lancement)
RUN mkdir -p models

# Port de l'API FastAPI
EXPOSE 8000

# Lancement
CMD ["python", "main.py"]
