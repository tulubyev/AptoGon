# APTOGON v0.2.0
**Human Firewall** — Gonka AI · did:key · Aptos

## Структура проекта
```
aptogon/
├── backend/          ← FastAPI API сервер
├── frontend/         ← Next.js 14 интерфейс
├── gonka/            ← AI библиотека (Gonka Network)
├── docker-compose.yml
└── .env.example
```

## Быстрый старт

### Docker (рекомендуется)
```bash
cp .env.example .env   # добавь GONKA_API_KEY
docker compose up
# → http://localhost:3000  (приложение)
# → http://localhost:8000/docs  (Swagger API)
```

### Локально
```bash
# Бэкенд
cd backend
pip install -r requirements.txt
PYTHONPATH=.. uvicorn main:app --reload --port 8000

# Фронтенд (новый терминал)
cd frontend
npm install && npm run dev
```

### Тесты Gonka AI (без сети)
```bash
cd gonka && python run_tests.py
# Ожидается: 28 тестов, 0 ошибок
```

## Стек
| Компонент | Технология | Задача |
|---|---|---|
| AI верификация | Gonka Network | Анализ паттерна жеста |
| Идентичность | did:key (W3C) | DID без серверов |
| Блокчейн | Aptos | HumanCredential on-chain |
| API | FastAPI | Backend |
| UI | Next.js 14 | Frontend |
| Кэш | Redis | Бот-скоры |

Убрано: ~~Cosmos SDK~~ · ~~Ceramic~~ · ~~IBC Bridge~~
