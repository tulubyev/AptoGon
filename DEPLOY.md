# Деплой APTOGON на VPS (homosapience.org)

## Архитектура
```
Internet → Traefik (:80/:443, SSL auto)
              ├── homosapience.org      → aptogon frontend → api (internal)
              ├── traefik.homosapience.org → traefik dashboard
              └── другие проекты...
```

---

## Шаг 1 — Создать общую Docker сеть

```bash
docker network create traefik-public
```

---

## Шаг 2 — Остановить nginx

```bash
sudo systemctl stop nginx
sudo systemctl disable nginx
```

---

## Шаг 3 — Запустить Traefik

```bash
mkdir -p /opt/traefik
cp /var/www/aptogon/traefik/docker-compose.yml /opt/traefik/
cd /opt/traefik
docker compose up -d
```

Проверить:
```bash
docker logs traefik -f
```

---

## Шаг 4 — Запустить APTOGON

```bash
cd /var/www/aptogon
docker compose -f docker-compose.prod.yml up -d
```

---

## Шаг 5 — Проверить

```bash
curl https://homosapience.org/
curl https://homosapience.org/api/
```

---

## Подключить другие проекты к Traefik

Для каждого существующего проекта добавить в его `docker-compose.yml`:

```yaml
networks:
  traefik-public:
    external: true

services:
  yourapp:
    networks:
      - traefik-public
    labels:
      - "traefik.enable=true"
      - "traefik.docker.network=traefik-public"
      - "traefik.http.routers.yourapp.rule=Host(`yourdomain.com`)"
      - "traefik.http.routers.yourapp.entrypoints=websecure"
      - "traefik.http.routers.yourapp.tls.certresolver=letsencrypt"
      - "traefik.http.services.yourapp.loadbalancer.server.port=<PORT>"
```

### Примеры для текущих сервисов на сервере:

| Сервис | Домен | Port |
|--------|-------|------|
| Portainer | portainer.homosapience.org | 9000 |
| pgAdmin | pgadmin.homosapience.org | 80 |
| Wiki.js | wiki.homosapience.org | 3000 |
| n8n | n8n.homosapience.org | 5678 |

---

## Обновление APTOGON

```bash
cd /var/www/aptogon
git pull origin main
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml build --no-cache
docker compose -f docker-compose.prod.yml up -d
```

---

## Логи

```bash
# Traefik
docker logs traefik -f

# APTOGON backend
docker compose -f docker-compose.prod.yml logs api -f

# APTOGON frontend
docker compose -f docker-compose.prod.yml logs frontend -f

# Попытки верификации
tail -f /tmp/aptogon_attempts.jsonl
```
