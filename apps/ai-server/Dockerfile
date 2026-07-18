FROM python:3.11-slim

# Dépendances système minimales
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 libgl1-mesa-glx libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copier requirements en premier (cache Docker)
COPY requirements.txt .

# Installer sans cache pour réduire la taille
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Code source
COPY . .

# Créer dossiers nécessaires
RUN mkdir -p models logs

# Port Railway (dynamique via $PORT)
EXPOSE 8000

# Démarrage
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1
