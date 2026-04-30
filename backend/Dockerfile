FROM python:3.12-slim
WORKDIR /app

# Зависимости backend
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

# Копируем backend и gonka-пакет
COPY backend/ ./backend/
COPY gonka/ ./gonka/

ENV PYTHONPATH=/app/gonka
WORKDIR /app/backend
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
