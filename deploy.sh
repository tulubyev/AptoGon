#!/bin/bash
# APTOGON — деплой на VPS
# Запускать на сервере: bash deploy.sh

set -e
echo "🚀 APTOGON deploy starting..."

# Обновить код
git pull origin main

# Пересобрать и перезапустить контейнеры
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml build --no-cache
docker compose -f docker-compose.prod.yml up -d

echo "✅ Done! Containers running:"
docker compose -f docker-compose.prod.yml ps
