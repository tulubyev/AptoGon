**APTOGON**

**v0.2.0  ·  Human Firewall Infrastructure**

Gonka AI  ·  did:key  ·  Aptos

*Техническое описание инфраструктуры, кода и деплоя*

Архив: aptogon\_v0.2.0\_full.zip

| Компонент | Технология | Статус |
| :---- | :---- | :---- |
| Верификация людей | Gonka AI / Qwen3 | ✓ Активен |
| Идентичность (DID) | did:key (W3C) | ✓ Активен |
| Блокчейн | Aptos (Move) | ✓ Активен |
| Backend API | FastAPI (Python) | ✓ Активен |
| Frontend | Next.js 14 | ✓ Активен |
| Кэш | Redis 7 | ✓ Активен |
| Cosmos SDK | УБРАН | ✗ Удалён |
| Ceramic/ComposeDB | УБРАН → did:key | ✗ Удалён |
| IBC Bridge | УБРАН | ✗ Удалён |

# **1\. Структура архива aptogon\_v0.2.0\_full.zip**

Единый архив объединяет три ранее разрозненных пакета в одно дерево. Никаких наложений, все пути согласованы.

aptogon/

├── backend/                 ← FastAPI API сервер

│   ├── main.py              ← точка входа

│   ├── Dockerfile           ← образ для Docker

│   ├── requirements.txt     ← Python зависимости

│   ├── middleware/

│   │   └── firewall.py      ← Human Firewall (проверка DID)

│   ├── routers/

│   │   ├── verify.py        ← POST /api/verify/expression

│   │   ├── bond.py          ← GET,POST /api/bond/\*

│   │   ├── chat.py          ← GET,POST /api/chat/\*, WS

│   │   ├── translate.py     ← POST /api/translate

│   │   └── governance.py    ← GET,POST /api/governance/\*

│   └── services/

│       ├── did\_key.py       ← W3C DID без серверов (замена Ceramic)

│       ├── aptos\_service.py ← Aptos blockchain

│       └── gonka\_service.py ← обёртка над gonka/

│

├── frontend/                ← Next.js 14

│   ├── Dockerfile

│   ├── package.json

│   ├── next.config.js       ← proxy /api/\* → :8000

│   ├── tailwind.config.js

│   └── src/

│       ├── app/

│       │   ├── page.tsx             ← главная

│       │   ├── verify/page.tsx      ← верификация (ключевая)

│       │   ├── chat/page.tsx        ← защищённый чат

│       │   ├── bond/page.tsx        ← P2P поручительство

│       │   ├── governance/page.tsx  ← голосование

│       │   ├── layout.tsx           ← root layout

│       │   └── globals.css          ← стили и анимации

│       └── components/

│           └── GestureCanvas.tsx    ← canvas для жеста

│

├── gonka/                   ← AI библиотека (Gonka Network)

│   ├── client.py            ← базовый HTTP клиент

│   ├── models.py            ← константы моделей

│   ├── expression\_engine.py ← верификация жеста

│   ├── antibot\_firewall.py  ← real-time детекция ботов

│   ├── translation\_bridge.py← перевод без Big Tech

│   ├── bond\_matcher.py      ← подбор поручителей

│   ├── ibc\_bridge.py        ← (резерв) IBC мост

│   ├── finetune\_pipeline.py ← fine-tuning AI моделей

│   ├── contracts/

│   │   └── sources/

│   │       └── hsi\_firewall.move ← Aptos Move смарт-контракт

│   └── tests/

│       ├── test\_all.py      ← 28 тестов (работают без сети)

│       └── test\_finetune.py

│

├── docker-compose.yml       ← 3 сервиса одной командой

├── .env.example             ← шаблон переменных окружения

└── README.md

| Папка | Файлов | Назначение |
| :---- | :---- | :---- |
| backend/ | 13 | FastAPI сервер, роутеры, сервисы, middleware |
| frontend/ | 11 | Next.js страницы, компоненты, конфигурация |
| gonka/ | 13 | AI библиотека, тесты, Move контракт |
| (корень) |  3 | docker-compose.yml, .env.example, README.md |
| ИТОГО | 40 | Единый проект без внешних зависимостей между архивами |

# **2\. Деплой и запуск**

## **2.1 Docker Compose — рекомендуемый способ**

*Требования: Docker Desktop 4.x+. Все три сервиса запускаются одной командой.*

\# Шаг 1: Распаковать архив

unzip aptogon\_v0.2.0\_full.zip && cd aptogon\_full

\# Шаг 2: Настроить переменные окружения

cp .env.example .env

\# Открыть .env и вставить GONKA\_API\_KEY=gk-...

\# Шаг 3: Запустить

docker compose up

\# Приложение:  http://localhost:3000

\# Swagger API: http://localhost:8000/docs

\# Redis:       localhost:6379

| Сервис | Образ | Порт | Описание |
| :---- | :---- | :---- | :---- |
| api | python:3.12-slim | 8000 | FastAPI \+ gonka AI библиотека |
| frontend | node:20-alpine | 3000 | Next.js 14, проксирует /api/\* → api:8000 |
| redis | redis:7-alpine | 6379 | Кэш бот-скоров (TTL 1 час) |

## **2.2 Локальный запуск без Docker**

\# ── Бэкенд ─────────────────────────────────────────────────────

cd aptogon\_full/backend

pip install \-r requirements.txt

cp ../.env.example ../.env   \# добавь GONKA\_API\_KEY

PYTHONPATH=.. uvicorn main:app \--reload \--port 8000

\# ── Фронтенд (новый терминал) ──────────────────────────────────

cd aptogon\_full/frontend

npm install && npm run dev

\# ── Тесты Gonka AI (без сети) ──────────────────────────────────

cd aptogon\_full

PYTHONPATH=. python gonka/tests/test\_all.py

\# → Tests run: 28  |  Failures: 0  |  ✓ ALL PASSED

**Ключевой момент — PYTHONPATH=.**

backend/services/gonka\_service.py импортирует gonka/ из корня проекта. При запуске из backend/ нужно указать PYTHONPATH=.. или запускать uvicorn из корня с PYTHONPATH=.

## **2.3 Переменные окружения**

| Переменная | Обязательна | По умолчанию | Описание |
| :---- | :---- | :---- | :---- |
| GONKA\_API\_KEY | ДА | — | API ключ Gonka. broker.gonkabroker.com |
| GONKA\_BASE\_URL | нет | broker.gonkabroker.com/v1 | URL Gonka broker API |
| GONKA\_FALLBACK | нет | true | При true — fallback при недоступности Gonka. Никогда не блокирует. |
| APTOS\_NODE\_URL | нет | testnet aptoslabs.com | Нода Aptos. Testnet бесплатен. |
| APTOS\_PRIVATE\_KEY | нет | (пустой) | Без ключа → local store в памяти. Достаточно для MVP. |
| APTOGON\_CONTRACT | нет | 0x1 | Адрес Move контракта hsi::credential |
| REDIS\_URL | нет | redis://localhost:6379 | Redis для кэша бот-скоров. Upstash.com — бесплатный хостинг. |
| HSI\_ENV | нет | development | development | production |

# **3\. Backend — FastAPI (backend/)**

## **3.1 main.py — точка входа**

**Путь в архиве: aptogon/backend/main.py**

* Создаёт FastAPI приложение с lifespan context (инициализация сервисов при старте)

* Загружает GonkaService и AptosService в app.state — доступны во всех роутерах

* Регистрирует CORSMiddleware: разрешает localhost:3000 и продакшн домен

* Подключает AptogonFirewall middleware — выполняется на каждый HTTP запрос

* Монтирует 5 роутеров под префиксами /api/verify, /api/bond, /api/chat, /api/translate, /api/governance

* GET /api/health — открытый эндпоинт для мониторинга, возвращает статистику Aptos

## **3.2 middleware/firewall.py — Human Firewall**

**Путь в архиве: aptogon/backend/middleware/firewall.py**

*Выполняется на каждый HTTP запрос. Является основной защитной линией системы.*

| Путь | Открытый? | Причина |
| :---- | :---- | :---- |
| /api/verify/\* | ДА — открытый | Нельзя требовать credential для его получения |
| /api/health | ДА — открытый | Мониторинг |
| /docs, /openapi | ДА — открытый | Swagger UI |
| /api/chat/\* | НЕТ — защищён | Только верифицированные люди пишут в чат |
| /api/bond/\* | НЕТ — защищён | Поручительство — только для людей |
| /api/governance/\* | НЕТ — защищён | 1 человек \= 1 голос — нельзя пустить бота |
| /api/translate | НЕТ — защищён | Доступ к переводчику |

**Алгоритм проверки (выполняется последовательно):**

* Читает заголовок X-APTOGON-DID из HTTP запроса

* Если заголовка нет → 403 с инструкцией как получить DID

* Проверяет формат: must start with did:key:z

* Вызывает AptosService.is\_human(did) → смотрит credential в Aptos или local store

* Если credential истёк → 403

* Если Aptos недоступен → пропускает (оптимистично), никогда не блокирует на outage

* Записывает request.state.did для использования в роутерах

## **3.3 services/did\_key.py — Замена Ceramic**

**Путь в архиве: aptogon/backend/services/did\_key.py**

*Реализует W3C стандарт did:key полностью на Python stdlib. Заменяет Ceramic \+ ComposeDB. 200 строк, 0 внешних зависимостей.*

| Функция / класс | Описание |
| :---- | :---- |
| DIDKey.generate() | Генерирует Ed25519 ключевую пару → DID строку did:key:z6Mk... |
| DIDKey.from\_private\_key(bytes) | Восстанавливает DID из приватного ключа (импорт из localStorage) |
| DIDKey.sign(message) | Подписывает сообщение приватным ключом → base64url подпись |
| DIDKey.sign\_credential(dict) | Создаёт W3C Verifiable Credential с proof блоком |
| DIDKey.export\_private() | Экспортирует приватный ключ как base64url — для сохранения в localStorage |
| DIDKey.verify(did, msg, proof) | Верифицирует подпись по публичному ключу из DID строки |
| create\_human\_credential(...) | Создаёт W3C VerifiableCredential типа HumanCredential |
| did\_hash(did) | SHA3-256 хэш, первые 12 символов — для анонимных логов |

**Алгоритм генерации DID (W3C did:key метод):**

Ed25519 приватный ключ (32 байта, os.urandom)

  → SHA-256 → публичный ключ (32 байта)

  → \[0xed, 0x01\] \+ pubkey (multicodec prefix)

  → base58btc encode → "z" \+ encoded

  → "did:key:" \+ "z" \+ encoded

  → did:key:z6MkfABC123...  ← финальный DID

|  | Ceramic (убрано) | did:key (текущее) |
| :---- | :---- | :---- |
| Инфраструктура | Ноды, ComposeDB, IPFS | Нет ничего |
| Зависимости | 5+ pip пакетов | 0 (только stdlib) |
| Генерация DID | HTTP запрос к ноде | 1 строка кода |
| Оффлайн работа | Невозможно | Полностью работает |
| W3C совместимость | Да | Да (тот же стандарт) |
| Время генерации | \~1-3 секунды | \<1 миллисекунды |

## **3.4 services/aptos\_service.py — Блокчейн**

**Путь в архиве: aptogon/backend/services/aptos\_service.py**

*Единственный блокчейн в APTOGON. Одна задача — хранить факт верификации.*

* issue\_credential(address, did\_hash, expression\_proof, bond\_count) — выдаёт credential

* is\_human(address) → bool — проверяет наличие действующего credential

* get\_credential(address) → CredentialRecord | None

* revoke(address) → bool — отзывает credential при обнаружении бота

* get\_stats() → {total, valid, revoked, network}

**Два режима работы:**

| Режим | Условие | Поведение |
| :---- | :---- | :---- |
| MVP / local store | APTOS\_PRIVATE\_KEY пустой | Хранит CredentialRecord в dict в памяти. Достаточно для разработки и демо. |
| Production | APTOS\_PRIVATE\_KEY задан | Отправляет транзакции в Aptos testnet/mainnet через REST API. Требует aptos-sdk. |
| Fallback | Aptos недоступен | Сохраняет в local\_store. Никогда не блокирует запросы. |

## **3.5 services/gonka\_service.py — AI интеграция**

**Путь в архиве: aptogon/backend/services/gonka\_service.py**

*Тонкая обёртка — импортирует gonka/ из корня проекта (PYTHONPATH=..), создаёт четыре AI-модуля.*

| Атрибут | Тип | Gonka модель | Задача |
| :---- | :---- | :---- | :---- |
| self.expression | ExpressionEngine | Qwen3-32B-FP8 | Анализ паттерна жеста → ExpressionProof |
| self.antibot | AntiBotFirewall | Qwen2.5-7B-Instruct | Real-time детекция ботов (1.5с timeout) |
| self.translation | TranslationBridge | Qwen3-32B-FP8 | Перевод без Google/DeepL, Aesopian decoder |
| self.bond\_matcher | BondMatcher | Qwen3-235B-Thinking | AI-подбор поручителей по репутации |

# **4\. Backend Routers — API эндпоинты**

| Файл | Префикс | Методы | Открытые пути |
| :---- | :---- | :---- | :---- |
| routers/verify.py | /api/verify | GET, POST | все |
| routers/bond.py | /api/bond | GET, POST | нет (нужен DID) |
| routers/chat.py | /api/chat | GET, POST, WS | нет (нужен DID) |
| routers/translate.py | /api/translate | GET, POST | нет (нужен DID) |
| routers/governance.py | /api/governance | GET, POST | GET proposals |

## **4.1 verify.py — Верификация жеста**

| Метод \+ Путь | Описание |
| :---- | :---- |
| POST /api/verify/expression | ГЛАВНЫЙ эндпоинт. Принимает TouchEvent\[\], запускает Gonka AI, генерирует did:key, пишет в Aptos. Возвращает {did, private\_key\_b64, tx\_hash, credential}. |
| GET  /api/verify/status?did=... | Проверяет статус credential по DID. Возвращает {is\_human, valid\_until, bond\_count}. |
| POST /api/verify/did | Создаёт did:key без верификации — только для разработки. |

## **4.2 bond.py — P2P Поручительство**

| Метод \+ Путь | Описание |
| :---- | :---- |
| GET  /api/bond/candidates | Список поручителей. AI-подбор через Gonka BondMatcher. Возвращает did\_hash\_short (12 символов), reputation, success\_rate. |
| POST /api/bond/request | Создать запрос на поручительство. Сохраняет в \_bond\_requests с UUID. |
| POST /api/bond/approve | Одобрить запрос. При 3+ одобрениях выдаётся HumanCredential. |
| POST /api/bond/reject | Отклонить запрос поручительства. |
| GET  /api/bond/my?did=... | Входящие и исходящие bond-запросы для DID. |

## **4.3 chat.py — Защищённый чат**

| Метод \+ Путь | Описание |
| :---- | :---- |
| GET /api/chat/messages | История последних 50 сообщений. Фильтр ?room=agora. |
| POST /api/chat/messages | Отправить сообщение. Требует X-APTOGON-DID. sender\_short \= первые 8 символов DID. |
| WS /api/chat/ws/{room} | WebSocket для real-time push. Все сообщения рассылаются подключённым клиентам. |

## **4.4 translate.py — Перевод**

| Метод \+ Путь | Описание |
| :---- | :---- |
| POST /api/translate | Перевод текста через Gonka TranslationBridge. Параметр sender\_region активирует спецпромпт для закрытых регионов. |
| GET  /api/translate/languages | 19 поддерживаемых языков: en, ru, fa, zh, ar, de, fr, es, be, uk, tr, ko, ja, pt, it, pl, nl, hi, hy. |

## **4.5 governance.py — Governance**

| Метод \+ Путь | Описание |
| :---- | :---- |
| GET  /api/governance/proposals | Список предложений. Фильтр ?status=voting|deposit|passed. |
| POST /api/governance/proposals | Создать предложение. Типы: text|parameter|ai\_model|upgrade|constitution. |
| POST /api/governance/proposals/{id}/support | Поддержать (нужно 100 поддержек для начала голосования). |
| POST /api/governance/vote | Проголосовать: yes / no / abstain / veto. |
| GET  /api/governance/proposals/{id}/tally | Подсчёт голосов с yes\_ratio, veto\_ratio, passed. |

# **5\. Gonka AI Library (gonka/)**

*Python пакет — AI-ядро системы. Импортируется бэкендом через PYTHONPATH. Работает без сети (все тесты мокированы).*

## **5.1 gonka/client.py — Базовый HTTP клиент**

* GonkaClient — async HTTP клиент для Gonka broker API (OpenAI-совместимый /v1/chat/completions)

* Автоматический retry: 3 попытки, exponential backoff (1с → 2с → 4с)

* Fallback при недоступности Gonka — возвращает консервативный ответ, никогда не бросает exception наружу

* Privacy guard — проверяет что поля raw\_coordinates, voice\_audio, ip\_address, did\_full не попали в payload

* UsageTracker — считает токены по задачам для HSI Fund accounting

## **5.2 gonka/expression\_engine.py — Верификация жеста**

*Реализует принцип: человек верифицируется действием, не личностью.*

| Класс | Задача |
| :---- | :---- |
| TouchEvent | Одно касание: {x, y, pressure, timestamp\_ms, pause\_after\_ms}. Координаты нормализованы 0.0-1.0. |
| TouchPattern | Статистика жеста (без координат): velocity\_std, pause\_entropy, correction\_count, rhythm\_irregularity... |
| PatternExtractor | Конвертирует TouchEvent\[\] → TouchPattern. Сырые XY уничтожаются здесь — дальше не идут. |
| ExpressionEngine | Оркестрирует полный флоу: события → паттерн → Gonka AI → ExpressionProof. |
| ExpressionResult | Результат: {is\_human, confidence, expression\_proof, reasoning, anomalies, via\_fallback}. |

**ExpressionProof — формат и свойства:**

* SHA3-256 хэш от {velocity\_std, pause\_entropy, corrections, session\_id, time\_bucket}

* time\_bucket \= int(unix\_time / 3600\) — привязан к часу, не к минуте (защита приватности)

* Разные session\_id → разные proof (защита от replay атак)

* Не содержит координаты, IP, биометрию — только математику

| Тип пользователя | Порог confidence | Основание |
| :---- | :---- | :---- |
| Обычный | 0.85 (85%) | Стандарт — высокая точность |
| Моторные ограничения | 0.70 (70%) | possible\_motor\_difficulty=True — тремор ≠ бот |
| Fallback (Gonka offline) | 0.70 (70%) | Консервативно: лучше пропустить, чем заблокировать человека |

## **5.3 gonka/antibot\_firewall.py — Real-time защита**

* Анализирует 5% запросов (SAMPLE\_RATE \= 0.05) — performance без потери качества

* Кэш в Redis — результат хранится 1 час на DID hash (первые 12 символов)

* При недоступности Gonka → всегда ALLOW — никогда не блокируем на outage

| Сигнал | Значение у бота | Значение у человека |
| :---- | :---- | :---- |
| interval\_cv (вариация интервалов) | ≈ 0.0 (машинная точность) | \> 0.5 (нерегулярность) |
| action\_diversity | \< 0.05 (один тип действий) | \> 0.3 (разные действия) |
| has\_sleep\_gap | False (24/7 онлайн) | True (человек спит) |
| response\_time\_std | \< 5 мс (одинаково) | \> 200 мс (вариация) |
| **Порог** | **Действие** | **Значение** |
| 0.60 | monitor | Наблюдать, не блокировать |
| 0.75 | reverify | Мягко попросить пройти верификацию снова |
| 0.90 | block | Запретить доступ до новой верификации |

## **5.4 gonka/translation\_bridge.py — Перевод**

* 19 языков, включая чувствительные регионы: IR (фарси), RU, CN, BY, KP, CU, SY, VE

* Для чувствительных регионов активируется SENSITIVE\_ADDENDUM — запрет цензурирования

* Aesopian decoder: выявляет кодированную речь и добавляет \[Note: may mean "..."\]

* Полная верность оригиналу — тон, регистр, ирония, юмор сохраняются

* Никаких данных не уходит в Google Translate / DeepL / Microsoft Azure

## **5.5 gonka/bond\_matcher.py — Подбор поручителей**

* find\_guarantors(candidates, requester, n\_select) → BondMatchResult

* Gonka Qwen3-235B-Thinking рассуждает о балансе надёжности и разнообразия

* Критерии: reputation\_score, success\_rate, last\_bond\_days\_ago, network\_depth

* В Gonka уходят только первые 8 символов DID (не полный хэш)

* Fallback: rule-based sort по score \= reputation × recency × success\_rate

## **5.6 gonka/contracts/sources/hsi\_firewall.move — Move контракт**

* Aptos Move смарт-контракт — хранит HumanCredential on-chain

* Функции: issue\_credential(), is\_human(), revoke(), get\_reputation()

* Move обеспечивает формальную безопасность — ресурсы нельзя дублировать

* Деплой через Aptos CLI: aptos move publish \--profile testnet

## **5.7 gonka/tests/test\_all.py — Тесты**

* 28 тестов, работают полностью без сети (Gonka мокирован)

* TestPatternExtractor (6) — логика извлечения паттерна, human vs bot

* TestExpressionEngine (8) — верификация, fallback, privacy гарантии

* TestAntiBotFirewall (5) — детекция, кэш, fallback при outage

* TestTranslationBridge (3) — перевод, чувствительные регионы

* TestBondMatcher (3) — подбор, fallback, rule-based

* TestPrivacyGuarantees (3) — КРИТИЧЕСКИЕ: координаты не уходят, DID усечён

# **6\. Frontend — Next.js 14 (frontend/)**

## **6.1 Конфигурация**

| Файл | Задача |
| :---- | :---- |
| next.config.js | Proxy: /api/\* → http://localhost:8000. В Docker: → http://api:8000 |
| tailwind.config.js | Сканирует src/\*\*/\*.{ts,tsx} для Tailwind классов |
| package.json | Next.js 14, React 18, TypeScript, Tailwind, Lucide React |
| src/app/layout.tsx | Root layout: html lang="ru", body с тёмным фоном \#0a0e1a |
| src/app/globals.css | CSS переменные брендовых цветов, анимации pulse-human, flash-rejected, gesture-canvas стиль |

## **6.2 src/app/page.tsx — Главная страница**

* Лендинг: название APTOGON, описание стека, три CTA кнопки

* Три карточки: Gonka AI (purple), did:key (cyan), Aptos (blue)

* Зачёркнутые технологии: \~\~Cosmos SDK\~\~ · \~\~Ceramic\~\~ · \~\~IBC\~\~ — честная коммуникация

* Статический рендер — никаких API вызовов при загрузке

## **6.3 src/app/verify/page.tsx — Верификация (ключевая страница)**

*Реализует полный флоу верификации в виде стейт-машины из 6 состояний.*

| Состояние | Отображение | Переход |
| :---- | :---- | :---- |
| draw | GestureCanvas, инструкция нарисовать символ | → analyzing (после жеста) |
| analyzing | Спиннер, список этапов Gonka AI | → success / failed |
| success | did:key создан, TX hash Aptos, кнопка bond | → bonding (по клику) |
| failed | Объяснение, советы рисовать медленнее | → draw (сброс) |
| bonding | Три аватара поручителей анимируются | → complete (при 3/3) |
| complete | Credential готов, ссылки в чат и bond | Финал |

**DID и ключ на фронтенде:**

* После успеха: localStorage.setItem("aptogon\_did", did) и localStorage.setItem("aptogon\_key", private\_key\_b64)

* Все последующие запросы добавляют заголовок X-APTOGON-DID: did:key:z6Mk...

* private\_key\_b64 передаётся с сервера единственный раз — далее он на клиенте

## **6.4 src/components/GestureCanvas.tsx — Canvas**

*Критический компонент с точки зрения приватности.*

* Рендерит HTML Canvas, захватывает mouse и touch события

* Нормализует XY в 0.0–1.0 — абсолютные пиксели не покидают компонент

* Поддержка Retina (devicePixelRatio), touch-action: none для мобильных

* Собирает TouchEventData\[\] с timestamp\_ms, pause\_after\_ms, pressure

* onComplete(events) — коллбэк после завершения жеста (минимум 10 точек)

* Визуальный feedback: синяя рамка → зелёная при готовности

## **6.5 src/app/chat/page.tsx — Защищённый чат**

* История сообщений из GET /api/chat/messages (последние 50\)

* POST /api/chat/messages с заголовком X-APTOGON-DID

* WebSocket на /api/chat/ws/agora — real-time push новых сообщений

* Правая панель — демо бот-атаки: кнопка запускает 5 ботов за 2 секунды

* HSI Firewall демо: боты получают 403, показывается параллельно с атакой

## **6.6 src/app/bond/page.tsx — Поручительство**

* Grid карточек кандидатов: did\_hash\_short (12 символов), reputation, success\_rate, last\_active\_days

* Чекбоксы для выбора — кнопка активна при выборе 3+ кандидатов

* Экран ожидания: аватары поручителей, счётчик одобрений

## **6.7 src/app/governance/page.tsx — Governance**

* Список предложений: тип, статус, полоса голосов (да/нет/вето), дней осталось

* Форма создания: заголовок, описание, тип — кнопки типов меняют срок голосования

* Кнопки голосования: За / Против / Воздержался / Вето с real-time счётчиками

# **7\. Безопасность и приватность**

## **7.1 Privacy-by-design гарантии**

| Данные | Где уничтожаются | Что идёт дальше |
| :---- | :---- | :---- |
| XY координаты жеста | GestureCanvas.tsx (браузер) | Нормализованные 0.0-1.0 статистика |
| Временны́е метки | PatternExtractor (бэкенд) | Относительные интервалы (мс) |
| Приватный ключ DID | Сервер → localStorage (1 раз) | Хранится только у пользователя |
| Полный DID | Никогда не логируется | Первые 12 символов SHA3-256 в логах |
| IP адрес | Не пишется в Gonka | Только стандартные nginx логи |
| Полный DID в bond | BondMatcher (бэкенд) | Первые 8 символов в запросе к Gonka |

## **7.2 Принцип отказоустойчивости**

**Ключевое правило: система никогда не блокирует пользователя из\-за своих собственных проблем.**

| Компонент упал | Поведение системы |
| :---- | :---- |
| Gonka AI недоступна | Fallback: is\_human=True, confidence=0.5 — лучше пропустить бота, чем заблокировать человека |
| Aptos недоступен | Credential сохраняется в local\_store, запросы продолжают работать |
| Redis недоступен | AntiBotFirewall переключается на in-memory dict кэш |
| WebSocket разорван | Next.js переподключается автоматически |

## **7.3 Защита от Replay атак**

* ExpressionProof включает session\_id — уникальный UUID на каждую сессию

* time\_bucket \= int(unix/3600) — один proof действителен максимум один час

* Aptos хранит использованные proof хэши — повторное использование невозможно

* Bond-запросы имеют UUID и статус — одобрить дважды нельзя

# **8\. Полная карта файлов архива**

*Все 40 файлов aptogon\_v0.2.0\_full.zip — путь, ответственность, ключевые элементы.*

| Путь в архиве | Ответственность | Ключевые классы / функции |
| :---- | :---- | :---- |
| .env.example | Шаблон переменных окружения | GONKA\_API\_KEY, APTOS\_PRIVATE\_KEY, REDIS\_URL |
| docker-compose.yml | Оркестрация: api \+ frontend \+ redis | 3 сервиса, порты 8000 \+ 3000 \+ 6379 |
| README.md | Краткая документация и быстрый старт | Docker / локальный запуск / тесты |
| backend/main.py | FastAPI приложение, lifespan, роутеры | app, lifespan() |
| backend/Dockerfile | Docker образ бэкенда | python:3.12-slim, PYTHONPATH=/app/gonka |
| backend/requirements.txt | Python зависимости | fastapi, uvicorn, redis, openai, pydantic |
| backend/middleware/firewall.py | Human Firewall — проверка DID | AptogonFirewall.dispatch() |
| backend/routers/verify.py | POST /api/verify/\* — верификация жеста | verify\_expression(), verify\_status() |
| backend/routers/bond.py | P2P поручительство | get\_candidates(), create\_bond\_request(), approve\_bond() |
| backend/routers/chat.py | Защищённый чат \+ WebSocket | post\_message(), websocket\_chat() |
| backend/routers/translate.py | Перевод без Big Tech | translate(), get\_languages() |
| backend/routers/governance.py | Предложения и голосование | create\_proposal(), cast\_vote(), tally() |
| backend/services/did\_key.py | W3C DID без серверов (замена Ceramic) | DIDKey, create\_human\_credential(), did\_hash() |
| backend/services/aptos\_service.py | Aptos блокчейн — HumanCredential | issue\_credential(), is\_human(), revoke() |
| backend/services/gonka\_service.py | Обёртка над gonka/ | GonkaService (expression, antibot, translation, matcher) |
| frontend/Dockerfile | Docker образ фронтенда | node:20-alpine, npm run build |
| frontend/package.json | Node.js зависимости | next@14, react@18, tailwindcss, typescript |
| frontend/next.config.js | Proxy /api/\* → backend:8000 | rewrites() |
| frontend/tailwind.config.js | Tailwind — сканирование src/\*\* | content: \[./src/\*\*/\*.{ts,tsx}\] |
| frontend/src/app/layout.tsx | Root layout Next.js | html lang="ru", dark bg, metadata |
| frontend/src/app/globals.css | Глобальные стили и анимации | pulse-human, flash-rejected, .gesture-canvas |
| frontend/src/app/page.tsx | Главная страница APTOGON | Home() — статический лендинг |
| frontend/src/app/verify/page.tsx | Верификация — главный флоу | VerifyPage(), 6-состояний стейт-машина |
| frontend/src/app/chat/page.tsx | Защищённый чат \+ бот-демо | ChatPage(), launchBotAttack() |
| frontend/src/app/bond/page.tsx | P2P выбор поручителей | BondPage(), simulateBonds() |
| frontend/src/app/governance/page.tsx | Предложения и голосование | GovernancePage(), castVote() |
| frontend/src/components/GestureCanvas.tsx | Canvas — сбор и нормализация жеста | GestureCanvas, TouchEventData, onComplete() |
| gonka/client.py | Gonka HTTP клиент, retry, fallback | GonkaClient.chat(), UsageTracker |
| gonka/models.py | Константы моделей Gonka | GonkaModel.PRIMARY, FAST, REASONING |
| gonka/expression\_engine.py | Анализ жеста → ExpressionProof | PatternExtractor, ExpressionEngine.verify() |
| gonka/antibot\_firewall.py | Real-time детекция ботов (5% sampling) | AntiBotFirewall.check(), RequestSampler |
| gonka/translation\_bridge.py | Перевод, Aesopian decoder | TranslationBridge.translate(), detect\_language() |
| gonka/bond\_matcher.py | AI-подбор поручителей | BondMatcher.find\_guarantors() |
| gonka/ibc\_bridge.py | (Резерв) IBC мост для будущего HSI Chain | IBCBridge, HSIFundManager |
| gonka/finetune\_pipeline.py | Fine-tuning HSI моделей на Gonka | FinetunePipeline, TrainingJob |
| gonka/fastapi\_integration.py | Альтернативная FastAPI обёртка (legacy) | create\_hsi\_app(), HSIFirewallMiddleware |
| gonka/contracts/sources/hsi\_firewall.move | Aptos Move смарт-контракт | issue\_credential(), is\_human(), revoke() |
| gonka/tests/test\_all.py | 28 тестов без сети | TestPatternExtractor, TestPrivacyGuarantees... |
| gonka/tests/test\_finetune.py | Тесты fine-tuning пайплайна | TestFinetunePipeline |
| gonka/setup.py | pip install \-e . (опционально) | name="hsi-gonka", version="0.1.0" |

*Gonka AI  ·  did:key  ·  Aptos  \=  APTOGON*

**Три технологии. Одна задача. Люди в сети.**