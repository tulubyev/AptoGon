# Защита от атаки Сивиллы в APTOGON / HSI

**Дата:** 2026-05-03  
**Статус:** Технический план, ожидает реализации  
**Проект:** homosapience.org / aptogon

---

## 1. Описание проблемы

### 1.1 Текущая архитектура верификации

Флоу верификации (`POST /api/verify/expression` в `/backend/routers/verify.py`):

1. Пользователь рисует жест на холсте (`GestureCanvas` во фронтенде)
2. `PatternExtractor` (в `/gonka/expression_engine.py`) извлекает статистический вектор: скорость, паузы, нерегулярность ритма — без сырых координат
3. Gonka AI (Qwen3-14B через OpenRouter) анализирует вектор, принимает решение `is_human: bool`
4. При успехе: `DIDKey.generate()` создаёт новую Ed25519 пару прямо в памяти бэкенда
5. SHA3-256 хэш DID записывается в Aptos как `HumanCredential`
6. Приватный ключ (`private_key_b64`) возвращается фронтенду, который сохраняет его в `localStorage`

### 1.2 Уязвимость: неограниченное создание DID

**Ключевой изъян:** каждая успешная верификация создаёт **независимый** blockchain-рекорд. Между записями нет никакой связи. Нет глобального реестра «один человек = одна запись».

Конкретные векторы атаки:

**Вектор A: Множественные верификации одним человеком.**  
Один человек проходит верификацию N раз (в разных браузерах, в режиме инкогнито, на разных устройствах). Каждый раз получает новый `did:key:z6Mk...`. Каждый DID имеет полноценный `HumanCredential` в Aptos. Один человек контролирует N голосов в governance, N позиций репутации.

**Вектор B: Очистка localStorage.**  
Пользователь очищает `localStorage` → DID потерян → новая верификация → новый DID. Технически легитимный флоу для восстановления доступа, но открывает бесплатную ротацию идентичностей.

**Вектор C: Автоматизированные боты.**  
Gonka AI детектирует ботов по нерегулярности жестов, но достаточно сложный бот (или скрипт, имитирующий человеческое движение) может систематически проходить верификацию. Текущий `AntiBotFirewall` в `/gonka/antibot_firewall.py` работает на уровне поведенческих паттернов запросов, а не на уровне повторной идентификации.

**Вектор D: Скоординированная атака на governance.**  
Если один актор контролирует 1000 верифицированных DID, он получает доминирующую позицию в любой системе голосования с весом 1 голос = 1 DID. Это прямая атака Сивиллы на механизмы консенсуса.

### 1.3 Почему это критично именно для HSI

APTOGON строится на принципе «один человек = один голос» (Human Sapience Internet). Вся ценность системы разрушается, если этот инвариант не соблюдается. Bond-система (`/backend/routers/bond.py`) предполагает, что поручительство исходит от реальных независимых людей — при Sybil-атаке граф поручительства деградирует в одного актора, притворяющегося толпой.

---

## 2. Варианты защиты

### Вариант A: Биометрический нечёткий хэш жеста

**Суть:**  
При каждой верификации вычислять «биометрический отпечаток» жеста — нечёткий (fuzzy) хэш вектора паттерна, устойчивый к небольшим вариациям одного человека, но различающий разных людей. Хранить отпечатки в базе. При новой верификации сравнивать с существующими — если расстояние ниже порога, считать повторной верификацией того же человека.

**Технические детали реализации:**

Входные данные для отпечатка — уже вычисленный `TouchPattern` из `/gonka/expression_engine.py`:
- `velocity_std`, `velocity_mean` — характеристика скорости
- `pause_entropy` — распределение пауз
- `rhythm_irregularity` — нерегулярность ритма
- `correction_count` — кол-во поправок

Алгоритм fuzzy-хэширования: SimHash или MinHash на нормализованном векторе признаков. Порог сходства (~85%) определяется эмпирически. Хранение: таблица `biometric_fingerprints` в PostgreSQL с индексом по хэш-бакетам (LSH — Locality Sensitive Hashing) для быстрого поиска похожих.

Задействованные файлы:
- `/gonka/expression_engine.py` — добавить метод `TouchPattern.to_fingerprint_vector() -> list[float]`
- `/backend/services/` — новый файл `biometric_store.py` с классом `BiometricFingerprintStore`
- `/backend/routers/verify.py` — проверка перед `DIDKey.generate()`

**Плюсы:**
- Не хранит сырые координаты — соответствует принципу zero-PII
- Работает без участия пользователя (пассивная защита)
- Не зависит от социального графа (работает при первой регистрации)
- Технически элегантно

**Минусы:**
- Ложные срабатывания: два человека с похожими паттернами жестов могут получить одинаковый отпечаток (особенно при простых жестах)
- Ложные пропуски: один человек, изменив стиль рисования, пройдёт как «другой»
- Требует подбора порога — нет универсального значения
- Нужна большая выборка реальных данных для калибровки
- Усложняет законную ротацию DID (потеря ключа)

**Сложность реализации:** Высокая. Требует исследования (R&D), эмпирической калибровки, отдельной БД-схемы. Оценка: 4-6 недель до MVP-качества.

---

### Вариант B: Социальный граф через HSI Bond

**Суть:**  
Новый DID получает не полный `HumanCredential`, а «стартовый» credential с весом 0. Полный вес (1.0) присваивается только после получения N поручительств от DID с уже полным весом. Система самовоспроизводится: первые участники верифицируются через биометрию или вручную, затем каждый следующий — через сеть поручительств.

**Текущее состояние Bond-системы:**  
`/backend/routers/bond.py` уже содержит скелет:
- `POST /api/bond/request` — запрос на поручительство
- `POST /api/bond/approve` — одобрение (при 3+ одобрениях выдаётся credential)
- In-memory хранилище `_bond_requests` — замечание: в production требует PostgreSQL

Проблема: сейчас Bond и верификация жестом — параллельные пути. Bond не влияет на `trust_score` credential.

**Архитектура доверия:**

```
Уровень 0: прошёл Gonka AI → trust_score = 0.1 (новичок)
Уровень 1: получил 3 поручительства от trust_score >= 0.5 → trust_score = 0.5
Уровень 2: получил 5 поручительств от trust_score >= 0.7 → trust_score = 1.0
```

`trust_score` хранится в `CredentialRecord` (добавить поле в `/backend/services/aptos_service.py`) и записывается в Aptos при каждом обновлении.

**Защита от Sybil:**  
Один атакующий с N DID не может сам себе выдать поручительства — поручитель и получатель не могут быть одним лицом (проверяется on-chain или на бэкенде). Более того, социальная стоимость поручительства растёт: поручитель рискует снижением своего `trust_score` при обнаружении бота.

**Плюсы:**
- Большая часть инфраструктуры уже существует (`/backend/routers/bond.py`)
- Атака Сивиллы экономически дорогая: нужно N «честных» поручителей
- Не требует биометрических баз данных
- Органичен для HSI-концепции: доверие = социальные связи

**Минусы:**
- «Холодный старт»: первые пользователи не могут получить поручительства
- Атака возможна при сговоре группы: «ферма поручительств»
- Медленный онбординг новых пользователей
- Требует активной сети участников

**Сложность реализации:** Средняя. Инфраструктура Bond есть, нужно добавить `trust_score` в модель credential и логику расчёта. Оценка: 1-2 недели.

---

### Вариант C: Rate limiting + device fingerprinting

**Суть:**  
Собирать device fingerprint в браузере (canvas fingerprint, список шрифтов, timing атаки через AudioContext, WebGL renderer), хэшировать в SHA3-256, хранить на бэкенде. Ограничивать количество верификаций с одного отпечатка за период.

**Компоненты fingerprint (privacy-preserving):**

Во фронтенде (`/frontend/src/app/[locale]/verify/page.tsx`):
```typescript
// Сырые данные НИКОГДА не покидают браузер
// Отправляется только SHA3-256 хэш от конкатенации
const fp = await collectFingerprint(); // canvas hash + font list hash + timing
const fpHash = await sha3_256(fp.canvas + fp.fonts + fp.timing);
// fpHash = "a3f2b1..." — анонимен, необратим
```

На бэкенде (`/backend/services/` — новый файл `device_fingerprint.py`):
```python
class DeviceFingerprintStore:
    def check_rate_limit(self, fp_hash: str, window_days: int = 30) -> RateLimitResult:
        # Сколько верификаций с этого fp_hash за последние window_days?
        # Возвращает: allowed=True/False, count=N, next_allowed_at=timestamp
        ...
    
    def record_verification(self, fp_hash: str, did_hash: str):
        # Связываем fp_hash → [did_hash_1, did_hash_2, ...] 
        # did_hash — не DID, а SHA3-256 первые 12 символов (уже анонимен)
        ...
```

Лимит: 1 верификация с одного fingerprint за 30 дней (настраивается через env `SYBIL_FP_WINDOW_DAYS`, `SYBIL_FP_MAX_VERIFICATIONS`).

**Задействованные файлы:**
- `/frontend/src/app/[locale]/verify/page.tsx` — сбор и хэширование fingerprint
- `/frontend/src/components/GestureCanvas.tsx` — можно добавить timing-данные холста
- `/backend/routers/verify.py` — проверка `fp_hash` до запуска Gonka
- `/backend/services/device_fingerprint.py` — новый сервис
- `/backend/main.py` — регистрация сервиса в `app.state`

**Плюсы:**
- Быстро реализуется (1 неделя)
- Не требует социального графа
- Работает для первых пользователей без «холодного старта»
- Не хранит PII — только хэш от технических характеристик браузера

**Минусы:**
- Обходится: VPN, другой браузер, другое устройство, headless Chromium с разными агентами
- Ложные срабатывания в корпоративных сетях (много пользователей за одним NAT с похожими браузерами)
- Canvas fingerprint нестабилен: обновление браузера меняет отпечаток
- Не работает против атакующего с парком устройств

**Сложность реализации:** Низкая. Оценка: 5-7 дней.

---

## 3. Рекомендуемый подход: B + C сейчас, A — долгосрочно

### Обоснование

**Вариант C (device fingerprinting)** — первая линия обороны. Дешёвый в реализации, сразу повышает стоимость атаки: вместо неограниченного числа верификаций атакующий ограничен числом уникальных браузерных профилей/устройств. Не решает проблему полностью, но резко поднимает планку.

**Вариант B (Social Graph / HSI Bond)** — основная долгосрочная защита. Органична концепции HSI: доверие строится через социальные связи, а не биометрию. Для Sybil-атаки нужна «ферма поручителей» — это требует реальных ресурсов и социальной инфильтрации, что на порядки сложнее технической атаки.

**Вариант A (биометрический fuzzy hash)** — исследовательская задача на 2-й год. Требует накопленной базы паттернов для калибровки. Реализовывать имеет смысл после сбора статистики по реальным жестам.

### Совместная работа B + C

```
POST /api/verify/expression
  │
  ├─ [C] Проверить fp_hash: не превышен ли лимит за 30 дней?
  │       ↓ превышен → HTTP 429, сообщение "Попробуйте позже"
  │
  ├─ Gonka AI анализирует жест
  │       ↓ не человек → HTTP 200, passed=False
  │
  ├─ DIDKey.generate() → новый DID
  │
  ├─ [B] issue_credential с trust_score=0.1 (не полный)
  │
  ├─ [C] Записать fp_hash → did_hash в DeviceFingerprintStore
  │
  └─ Вернуть DID + credential (trust_score=0.1 явно указан в ответе)

Отдельно — async процесс повышения trust_score через Bond:
POST /api/bond/approve
  │
  └─ При N одобрениях → обновить trust_score в AptosService
```

---

## 4. План реализации

### Фаза 1: Device Fingerprinting (1 неделя)

**Шаг 1. Фронтенд — сбор fingerprint**

Файл: `/frontend/src/app/[locale]/verify/page.tsx`

Добавить функцию сбора до отправки жеста:

```typescript
async function collectDeviceFingerprint(): Promise<string> {
  // 1. Canvas fingerprint
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#f60';
  ctx.fillRect(0, 0, 10, 10);
  ctx.fillStyle = '#069';
  ctx.font = '14px Arial';
  ctx.fillText('hsi', 2, 15);
  const canvasData = canvas.toDataURL();

  // 2. Platform signals (не личные данные)
  const platform = [
    navigator.hardwareConcurrency,
    navigator.language,
    screen.colorDepth,
    screen.width + 'x' + screen.height,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  ].join('|');

  // 3. Хэшируем локально — сырые данные никуда не уходят
  const raw = canvasData + '||' + platform;
  const hashBuffer = await crypto.subtle.digest(
    'SHA-256',  // SHA-3 недоступен в WebCrypto, используем SHA-256
    new TextEncoder().encode(raw)
  );
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
```

Включить `fp_hash` в тело запроса `ExpressionRequest`.

**Шаг 2. Бэкенд — модель запроса**

Файл: `/backend/routers/verify.py`

```python
class ExpressionRequest(BaseModel):
    events: list[TouchEventDTO] = Field(..., min_length=3)
    session_id: Optional[str] = None
    fp_hash: Optional[str] = None  # SHA-256 device fingerprint (64 hex символа)
```

**Шаг 3. Бэкенд — сервис fingerprint**

Новый файл: `/backend/services/device_fingerprint.py`

```python
import hashlib
import time
from dataclasses import dataclass, field
from typing import Optional

FP_WINDOW_DAYS = int(os.getenv("SYBIL_FP_WINDOW_DAYS", "30"))
FP_MAX_VERIFICATIONS = int(os.getenv("SYBIL_FP_MAX_VERIFICATIONS", "3"))

@dataclass
class FingerprintRecord:
    fp_hash: str                       # SHA-256 хэш fingerprint
    verifications: list[dict] = field(default_factory=list)
    # каждый элемент: {"ts": int, "did_hash_short": str}

class DeviceFingerprintStore:
    """
    In-memory MVP → заменить на PostgreSQL в production.
    Таблица: device_fingerprints(fp_hash TEXT PK, verifications JSONB)
    """
    def __init__(self):
        self._store: dict[str, FingerprintRecord] = {}

    def check_and_record(self, fp_hash: str, did_hash_short: str) -> dict:
        """
        Возвращает {"allowed": bool, "count": int, "next_allowed_at": int|None}
        Если allowed=True, сразу записывает верификацию.
        """
        now = int(time.time())
        window_start = now - FP_WINDOW_DAYS * 86400

        rec = self._store.setdefault(fp_hash, FingerprintRecord(fp_hash=fp_hash))
        # Фильтруем старые записи
        rec.verifications = [v for v in rec.verifications if v["ts"] > window_start]

        count = len(rec.verifications)
        if count >= FP_MAX_VERIFICATIONS:
            oldest = min(v["ts"] for v in rec.verifications)
            next_allowed = oldest + FP_WINDOW_DAYS * 86400
            return {"allowed": False, "count": count, "next_allowed_at": next_allowed}

        rec.verifications.append({"ts": now, "did_hash_short": did_hash_short})
        return {"allowed": True, "count": count + 1, "next_allowed_at": None}
```

**Шаг 4. Интеграция в verify.py**

Файл: `/backend/routers/verify.py`

Вставить проверку в начало `verify_expression`, до вызова Gonka:

```python
@router.post("/expression", response_model=VerifyResponse)
async def verify_expression(body: ExpressionRequest, request: Request):
    fp_store: DeviceFingerprintStore = request.app.state.fp_store

    # [Sybil Protection C] Device fingerprint rate limit
    if body.fp_hash:
        fp_result = fp_store.check_and_record(
            fp_hash=body.fp_hash,
            did_hash_short="pending"  # DID ещё не создан
        )
        if not fp_result["allowed"]:
            from fastapi import HTTPException
            raise HTTPException(
                status_code=429,
                detail={
                    "error": "verification_rate_limit",
                    "message": "Слишком много верификаций с этого устройства",
                    "next_allowed_at": fp_result["next_allowed_at"],
                }
            )
    # ... остальной код без изменений
```

**Шаг 5. Регистрация в main.py**

Файл: `/backend/main.py`

```python
from services.device_fingerprint import DeviceFingerprintStore
app.state.fp_store = DeviceFingerprintStore()
```

---

### Фаза 2: Trust Score через HSI Bond (2 недели)

**Шаг 1. Расширить CredentialRecord**

Файл: `/backend/services/aptos_service.py`

```python
@dataclass
class CredentialRecord:
    address: str
    did_hash: str
    expression_proof: str
    bond_count: int
    issued_at: int
    valid_until: int
    revoked: bool = False
    trust_score: float = 0.1   # НОВОЕ: 0.1 = новичок, 1.0 = полное доверие
    bond_sponsors: list[str] = field(default_factory=list)  # did_hash поручителей
```

Move-контракт Aptos (`hsi::credential`) расширить аргументом `trust_score` (u64, умножить на 100 для целочисленного хранения).

**Шаг 2. Логика обновления trust_score**

Файл: `/backend/routers/bond.py`

В `approve_bond` заменить заглушку на реальную логику:

```python
@router.post("/approve")
async def approve_bond(body: BondApprove, request: Request):
    aptos: AptosService = request.app.state.aptos
    bond_req = _bond_requests.get(body.request_id)
    # ... существующая валидация ...

    # Защита от самоподдельных поручительств
    if body.approver_did == bond_req["requester"]:
        raise HTTPException(400, "Cannot vouch for yourself")

    bond_req["approvals"].append(body.approver_did)
    approval_count = len(bond_req["approvals"])

    # Рассчитать новый trust_score
    new_trust_score = _calculate_trust_score(approval_count)

    if new_trust_score > 0.1:  # было повышение
        await aptos.update_trust_score(
            address=bond_req["requester"],
            new_score=new_trust_score,
            bond_sponsors=[did_hash(d)[:12] for d in bond_req["approvals"]],
        )
    # ...

def _calculate_trust_score(bond_count: int) -> float:
    """
    0 bonds → 0.1 (прошёл Gonka AI)
    3 bonds → 0.5 (признан сообществом)
    7 bonds → 1.0 (полное доверие)
    """
    if bond_count == 0: return 0.1
    if bond_count < 3:  return 0.1 + bond_count * 0.1
    if bond_count < 7:  return 0.5 + (bond_count - 3) * 0.1
    return 1.0
```

**Шаг 3. Добавить update_trust_score в AptosService**

Файл: `/backend/services/aptos_service.py`

```python
async def update_trust_score(
    self,
    address: str,
    new_score: float,
    bond_sponsors: list[str],
) -> dict:
    if address in self._local_store:
        self._local_store[address].trust_score = new_score
        self._local_store[address].bond_sponsors = bond_sponsors
        self._local_store[address].bond_count = len(bond_sponsors)
    # В production: вызов hsi::credential::update_trust_score(address, score_u64)
    return {"updated": True, "trust_score": new_score}
```

**Шаг 4. Фронтенд — отображение trust_score**

Файл: `/frontend/src/app/[locale]/verify/page.tsx`

Добавить в ответ на успешную верификацию:
- Badge «Новичок (trust: 0.1)» / «Признан сообществом (trust: 0.5)» / «Доверенный (trust: 1.0)»
- CTA: «Получите поручительства чтобы повысить доверие» с кнопкой перехода в `/bond`

**Шаг 5. Верификация поручителя**

Файл: `/backend/routers/bond.py`

В `approve_bond` добавить проверку, что `approver_did` имеет `trust_score >= 0.5` прежде чем засчитывать поручительство:

```python
approver_credential = await aptos.get_credential(body.approver_did)
if not approver_credential or approver_credential.trust_score < 0.5:
    raise HTTPException(403, "Insufficient trust score to vouch for others")
```

---

### Фаза 3: PostgreSQL вместо in-memory (параллельно с фазой 2)

Оба новых сервиса (`DeviceFingerprintStore`, `_bond_requests`) используют in-memory хранилища. В production заменить на PostgreSQL:

Новый файл: `/backend/services/db.py` — единое подключение SQLAlchemy/asyncpg.

Схема таблиц:
```sql
-- Fingerprints
CREATE TABLE device_fingerprints (
    fp_hash     CHAR(64) PRIMARY KEY,
    verifications JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_at  TIMESTAMPTZ DEFAULT now()
);

-- Bond requests
CREATE TABLE bond_requests (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_hash  CHAR(12) NOT NULL,  -- did_hash_short, не DID
    expression_proof TEXT,
    status          VARCHAR(20) DEFAULT 'pending',
    approvals       JSONB DEFAULT '[]'::jsonb,
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- Credentials (если не хранить только в Aptos)
CREATE TABLE credentials (
    address         TEXT PRIMARY KEY,
    did_hash        CHAR(64) NOT NULL,
    trust_score     NUMERIC(3,2) DEFAULT 0.10,
    bond_count      INT DEFAULT 0,
    issued_at       BIGINT,
    valid_until     BIGINT,
    revoked         BOOLEAN DEFAULT false
);
```

---

## 5. Соображения по приватности

### Принцип zero-PII — как соблюдается в каждом варианте

**Device fingerprinting (Вариант C):**
- Canvas, шрифты, размер экрана — технические характеристики, не личные данные
- Сырые данные никогда не покидают браузер — хэшируются через `crypto.subtle.digest` локально
- Бэкенд получает только SHA-256 (64 hex символа) — необратимый, не привязан к личности
- В БД хранится только `{fp_hash → [{"ts": unix, "did_hash_short": "a3f2b1..."}]}`
- `did_hash_short` — первые 12 символов SHA3-256 от DID, не сам DID
- Связь `fp_hash → did` невозможна восстановить из хранилища

**Social Graph / HSI Bond (Вариант B):**
- В Bond-запросах хранятся DID, не реальные личности
- Граф поручительств публичен on-chain — но DID анонимны
- `requester_hash` в PostgreSQL — короткий хэш, не DID
- Сообщение поручителю (`message` в `BondRequestCreate`) опционально и должно быть ограничено по длине (max 200 символов)

**Биометрия (Вариант A, будущее):**
- Fuzzy hash жеста: хранится только статистический вектор после нормализации, не траектория
- Сырые `(x, y)` координаты не записываются — это уже гарантирует `TouchPattern` в `/gonka/expression_engine.py`
- Биометрический отпечаток хранится отдельно от DID — связь между ними не должна быть восстановима
- Рекомендация: добавить `salt` к fingerprint при хранении, соль ротируется раз в год

### Что запрещено хранить явно

| Данные | Статус |
|---|---|
| Сырые XY-координаты жеста | Запрещено — уже соблюдается |
| IP-адрес пользователя | Запрещено хранить постоянно (только для rate-limit в RAM, TTL 1 час) |
| User-Agent строка | Запрещено — только хэш технических характеристик |
| Связь fp_hash → DID в открытом виде | Запрещено — только did_hash_short |
| Временны́е метки с точностью < 1 минуты | Запрещено — позволяет корреляцию |
| Canvas pixel data | Запрещено — только хэш |

### Право на повторную верификацию

При легитимной потере DID (смена устройства, очистка данных) пользователь должен иметь возможность пройти верификацию заново. Механизм:

1. `DeviceFingerprintStore` хранит не жёсткий запрет, а rate-limit с TTL
2. Пользователь может подать апелляцию через Bond-систему: N поручителей могут «сбросить» fp_hash лимит для конкретного DID
3. Новый API: `POST /api/verify/appeal` — запрос на ручной сброс лимита (требует 5 поручительств с trust_score >= 0.7)

---

## 6. Карта файлов — итого

| Файл | Изменение |
|---|---|
| `/backend/routers/verify.py` | Добавить `fp_hash` в `ExpressionRequest`, проверку rate-limit |
| `/backend/routers/bond.py` | Добавить `trust_score` логику, защиту от самопоручительства, проверку trust_score поручителя |
| `/backend/services/aptos_service.py` | Добавить `trust_score` в `CredentialRecord`, метод `update_trust_score` |
| `/backend/services/device_fingerprint.py` | Новый файл: `DeviceFingerprintStore` |
| `/backend/services/db.py` | Новый файл: PostgreSQL подключение (для фазы 3) |
| `/backend/main.py` | Регистрация `fp_store` в `app.state` |
| `/frontend/src/app/[locale]/verify/page.tsx` | Сбор и хэширование device fingerprint, отображение trust_score |
| `/frontend/src/components/GestureCanvas.tsx` | Опционально: timing-данные для fingerprint |
| `/gonka/expression_engine.py` | В будущем (вариант A): метод `to_fingerprint_vector()` |

---

## 7. Приоритет задач

```
[P0] Фаза 1, шаг 3-4: DeviceFingerprintStore + интеграция в verify.py
     → Немедленная базовая защита без сложной инфраструктуры

[P1] Фаза 1, шаг 1-2: Фронтенд сбор fp_hash
     → Без этого бэкенд-проверка не активируется

[P2] Фаза 2, шаг 1-3: trust_score в CredentialRecord + Bond логика
     → Основная долгосрочная защита

[P3] Фаза 2, шаг 4-5: Фронтенд trust_score + валидация поручителя
     → UX + ужесточение Bond-системы

[P4] Фаза 3: PostgreSQL вместо in-memory
     → Обязательно перед production deploy

[P5] Вариант A: Биометрический fuzzy hash
     → R&D задача, не раньше накопления 10k+ реальных верификаций
```
