# Деплой APTOGON на VPS (homosapience.org)

## Требования к серверу
- Ubuntu 22.04 / Debian 12
- 2 GB RAM минимум (4 GB рекомендуется)
- Docker + Docker Compose
- Домен homosapience.org направлен на IP сервера

---

## Шаг 1 — Подключись к VPS

```bash
ssh root@<IP_СЕРВЕРА>
```

---

## Шаг 2 — Установи Docker

```bash
apt update && apt upgrade -y
apt install -y docker.io docker-compose-plugin git curl
systemctl enable docker && systemctl start docker
```

---

## Шаг 3 — Клонируй репозиторий

```bash
git clone https://github.com/tulubyev/AptoGon.git /opt/aptogon
cd /opt/aptogon
```

---

## Шаг 4 — Создай .env файл

```bash
cp .env.example .env   # или создай вручную
nano .env
```

Минимальный `.env` для production:
```
GONKA_PROVIDER=openrouter
GONKA_BASE_URL=https://openrouter.ai/api/v1
GONKA_API_KEY=sk-or-...          # твой ключ OpenRouter
GONKA_MODEL=qwen/qwen3-14b
GONKA_FALLBACK=true

APTOS_NETWORK=mainnet
APTOS_PRIVATE_KEY=0x...          # ключ Aptos кошелька
APTOS_CONTRACT_ADDRESS=0x...
```

---

## Шаг 5 — SSL сертификат (Let's Encrypt)

```bash
apt install -y certbot
certbot certonly --standalone -d homosapience.org -d www.homosapience.org
```

---

## Шаг 6 — Настрой nginx

```bash
apt install -y nginx
cp /opt/aptogon/nginx.conf /etc/nginx/sites-available/homosapience
ln -s /etc/nginx/sites-available/homosapience /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

---

## Шаг 7 — Запусти приложение

```bash
cd /opt/aptogon
bash deploy.sh
```

---

## Шаг 8 — Проверь

```bash
curl https://homosapience.org/         # главная страница
curl https://homosapience.org/api/     # API
```

---

## Обновление кода

При каждом новом коммите на сервере достаточно:
```bash
cd /opt/aptogon && bash deploy.sh
```

---

## Автообновление SSL (cron)

```bash
crontab -e
# Добавь строку:
0 3 * * * certbot renew --quiet && systemctl reload nginx
```

---

## Логи

```bash
# Логи backend
docker compose -f docker-compose.prod.yml logs api -f

# Логи frontend
docker compose -f docker-compose.prod.yml logs frontend -f

# Попытки верификации
tail -f /tmp/aptogon_attempts.jsonl
```
