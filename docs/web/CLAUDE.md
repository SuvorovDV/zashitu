# CLAUDE.md — веб-версия ZaShitu

> Читай этот файл ПЕРВЫМ в каждой сессии. Он даёт полный контекст.
> После изменений обновляй PROGRESS.md и DECISIONS.md.

> **🔴 Начинаешь новую сессию? Открой `ROADMAP.md` — там в разделе ❌ список
> того что НЕ сделано, и раздел «Подводные камни на старте новой сессии».
> `REVIEW.md` — 60 проблем по приоритетам (многие ещё открыты).**

---

## Что это за проект

**ZaShitu Web** — React-приложение для генерации академических презентаций (.pptx).

Это **второй канал** рядом с Telegram-ботом. Бот остаётся, веб добавляется параллельно.

**Флоу пользователя:**
регистрация → форма (10 шагов) → загрузка файла работы → выбор тарифа → оплата Stripe → получение .pptx

**Главная ценность:** презентации генерируются строго по загруженной работе студента,
с ссылками на страницы (`source_grounded` режим). Никаких галлюцинаций.

**Не делаем:** редактирование слайдов в браузере, превью .pptx, промокоды,
Telegram-связку аккаунтов — всё это после MVP.

---

## Стек

### Фронтенд
- React 18 + Vite
- React Router v6
- Zustand — стейт визарда и авторизации (`persist` в localStorage)
- TanStack Query (React Query) — серверный стейт, polling генерации
- Tailwind CSS + кастомная дизайн-система
- axios с interceptors для refresh токена

### Бэкенд
- FastAPI (Python)
- SQLite (dev) / PostgreSQL (prod) + asyncpg + SQLAlchemy async
- Redis + Celery — очередь задач генерации
- Stripe SDK — оплата
- python-jose — JWT
- bcrypt — хеширование паролей
- python-pptx — используется в fallback (не основной генератор)

### Генерация
Celery-воркер → `_pptxgenjs_generator()`:
1. Строит skeleton слайдов (`_build_skeleton`)
2. Если есть `ANTHROPIC_API_KEY` → Claude API (`_generate_with_claude`)
3. Если нет → placeholder на русском (`_generate_placeholder`)
4. Передаёт JSON-план в `pptxgen.js` через stdin
5. `_fix_cyrillic_charset()` патчит charset в ZIP

`GENERATION_MODE=real` → пробует импортировать реальный генератор из `../zashitu/`.

---

## Текущее состояние проекта (актуально на 2026-04-14, после сессии #3)

MVP реализован + завершены Phase 1–5 рефакторинга и редизайна. Локальная разработка без Docker.

### Что реализовано (базово)
- Полный бэкенд: auth, orders, payments, generation, files
- Полный фронтенд: 10 шагов визарда, все страницы
- Генерация .pptx через Node.js pptxgenjs
- Dev-режим: симуляция оплаты без Stripe
- **69 бэкенд тестов (pytest) + 46 фронтенд тестов (vitest) — все зелёные**

### Что добавлено в сессии #2 (палитра + CRITICAL security)
- Палитра Янтарь (`#F59E0B` + warm-dark `#0F0E0B`/`#1A1712`), без фиолета
- `SECRET_KEY` валидация, secure cookies, `X-Dev-Token` для `/dev/*`, Stripe webhook идемпотентность
- `auth/rate_limit.py`, `files/validators.py` (magic bytes), `logging_config.py` + HTTP-middleware
- Индексы БД на Order/UploadedFile
- Frontend: `ErrorBoundary`, `TopProgressBar`, refresh-queue fix, `store.partialize`, backoff polling

### Что добавлено в сессии #3 (Phase 2–5: рефакторинг + редизайн)
Backend:
- **Repository-слой:** `auth/repository.py`, `orders/repository.py`, `files/repository.py` (router → service → repository)
- **Alembic:** `alembic.ini`, `alembic/env.py`, `versions/0001_baseline.py` (async-совместимый)
- **`OrderStatus` enum consistency:** везде `.value` при записи, строковое сравнение при чтении
- **`security_headers.py`** + `SecurityHeadersMiddleware` (CSP, HSTS, XFO, XCTO, Referrer, Permissions) + `TrustedHostMiddleware`
- Anthropic singleton, Pydantic `SlideContent` для валидации ответа Claude
- `STRIPE_SECRET_KEY` guard в prod, Celery `task_soft_time_limit`/`retry_backoff`
- zipfile path-traversal защита в `_fix_cyrillic_charset`, TOCTOU fix в `/files/download`
- `MAX_FILE_SIZE_MB` в settings, `PYTHONIOENCODING=utf-8` для Node, pathlib в `generation/tasks.py`
- Новые deps: `psycopg2-binary`, `alembic`, `redis`, `anthropic`, `openai`, `Pillow`

Frontend:
- **`features/` барrel-реэкспорты:** `src/features/{auth,wizard,generation,payment,dashboard}/index.js`, `src/shared/{ui,api,i18n}/` (плоские `pages/components/hooks/store/api/` оставлены для совместимости)
- **Новые UI-компоненты:** `Toast` провайдер, `Modal`/`ConfirmDialog` (focus trap + Esc), `Card`, `Badge`, `Textarea`, `Select`
- `alert()/confirm()` → `Toast`/`Modal` (Dashboard, Generation, Payment)
- **Wizard редизайн:** `WizardSidebar` (sticky, 10 шагов, клавиатура, `aria-current="step"`), sticky footer, fade-анимация; mobile — `WizardProgress`
- **Typography:** Inter + JetBrains Mono в `index.html` + `tailwind.config.js`
- `useDevMode()` читает `/health` вместо `VITE_DEV_MODE`; `src/lib/uuid.js` + валидация UUID на Payment/Generation
- `i18n/ru.js` — централизованные строки; 429/ERR_NETWORK handling в Login/Register
- a11y: `aria-current="page"` в Navbar, `role="status"`, `Input` с `useId`/`aria-invalid`/`aria-describedby`

### Что НЕ реализовано (остаётся на будущее)
- Полная миграция фронта в `features/` (сейчас barrel + плоские пути; нужно физически переместить файлы)
- Мобильный UX Wizard (sidebar скрыт, степы не все оттестированы)
- Trust-bar / FAQ accordion / hero-display typography на Landing
- Тесты refresh-queue concurrent 401 на фронте (сложный мок)
- UUID-валидация path-параметров на бэке

**После MVP (низкий приоритет):**
- Google OAuth
- Email-подтверждение
- S3/R2 хранение файлов
- Промокоды
- Telegram-связка аккаунтов

---

## Структура проекта

```
zashitu-web/
├── CLAUDE.md              ← читать первым
├── PROGRESS.md            ← статус модулей и история изменений
├── DECISIONS.md           ← архитектурные решения и их причины
├── docker-compose.yml     ← PostgreSQL 15 + Redis 7 (для прода)
├── .env.example
├── .env                   ← SQLite + memory broker (локальная разработка)
│
├── backend/
│   ├── main.py
│   ├── config.py              ← TIERS, все настройки
│   ├── database.py
│   ├── models.py              ← User, Order, UploadedFile
│   ├── celery_app.py
│   ├── dev_router.py          ← /dev/* (DEV_MODE=True + X-Dev-Token)
│   ├── logging_config.py      ← structured logging
│   ├── security_headers.py    ← CSP/HSTS/XFO middleware
│   ├── requirements.txt
│   ├── pytest.ini
│   ├── alembic.ini
│   ├── alembic/               ← env.py, versions/0001_baseline.py
│   ├── auth/                  ← router, service, repository, rate_limit
│   ├── orders/                ← router, service, repository
│   ├── payments/
│   ├── generation/
│   │   ├── tasks.py           ← Celery + Claude + pptxgenjs
│   │   └── pptxgen.js         ← Node.js генератор .pptx
│   ├── files/                 ← router, service, repository, validators (magic bytes)
│   └── tests/                 ← 69 pytest тестов (8 файлов)
│       ├── conftest.py        ← autouse сброс rate-limiter
│       ├── test_auth_service.py, test_auth_router.py
│       ├── test_orders_service.py
│       ├── test_rate_limit.py, test_magic_bytes.py
│       ├── test_dev_token.py, test_security_headers.py
│       └── test_webhook_idempotency.py
│
└── frontend/
    ├── index.html             ← color-scheme: dark, Inter + JetBrains Mono
    ├── package.json           ← vitest, @testing-library/react, react-router-dom
    ├── vite.config.js         ← proxy + test config
    ├── tailwind.config.js     ← amber tokens, Inter/JetBrains fontFamily
    └── src/
        ├── index.css          ← amber дизайн-токены, .card, .glow, .text-gradient
        ├── App.jsx
        ├── api/               ← client.js (refresh-queue)
        ├── store/index.js     ← authStore + wizardStore (persist + partialize)
        ├── hooks/index.js     ← useAuth, useGenerationStatus, useDevMode
        ├── lib/uuid.js        ← isValidUuid
        ├── i18n/ru.js         ← централизованные строки
        ├── shared/            ← ui/, api/, i18n/ barrel-реэкспорты
        ├── features/          ← auth/, wizard/, generation/, payment/, dashboard/ (barrel index.js)
        ├── components/
        │   ├── layout/        ← Navbar, ProtectedRoute, ErrorBoundary
        │   ├── ui/            ← Button, Input, Spinner, FileUpload, ParticleBackground,
        │   │                     TopProgressBar, Toast, Modal, Card, Badge, Textarea, Select
        │   └── wizard/        ← WizardProgress, WizardSidebar, steps/Step1–10
        ├── pages/             ← Landing, Login, Register, Dashboard,
        │                         Wizard, Payment, Generation, NotFound
        └── __tests__/         ← 46 vitest тестов (api, Button, ErrorBoundary, uuid, store)
```

---

## Быстрый старт (локально, без Docker)

```bash
# .env уже настроен для локальной разработки

# Бэкенд
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000

# Фронтенд (отдельный терминал)
cd frontend
npm install
npm run dev

# Открыть: http://localhost:5173 — фронт
#          http://localhost:8000/docs — API docs
```

**Celery воркер не нужен** — `CELERY_TASK_ALWAYS_EAGER=True` выполняет задачи синхронно.

**Stripe не нужен** — `DEV_MODE=True` добавляет кнопку "Симулировать оплату" на странице Payment.

---

## Запуск с PostgreSQL + Redis (production-like)

```bash
cp .env.example .env
# Заполни .env: SECRET_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, ANTHROPIC_API_KEY
docker-compose up -d

cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Celery воркер (отдельный терминал)
celery -A celery_app worker --loglevel=info

cd frontend
npm install
npm run dev

# Stripe webhook
stripe listen --forward-to localhost:8000/payments/webhook
```

---

## Запуск тестов

```bash
# Бэкенд (69 тестов)
cd backend
python -m pytest tests/ -v

# Фронтенд (46 тестов)
cd frontend
npm test

# Watch режим
npm run test:watch
```

---

## Дизайн-система (палитра Янтарь)

### Цветовые токены

| Токен | CSS класс | Hex | Назначение |
|-------|-----------|-----|-----------|
| bg | `bg-[#0F0E0B]` | `#0F0E0B` | Фон всего приложения (warm-black) |
| surface | `.card` | `#1A1712` | Фон карточек |
| surface-raised | `.card-hover` | `#221E17` | Hover карточек |
| border | `.card` | `#2E2820` | Граница карточек |
| border-hi | hover border | `#4A402F` | Hover границы |
| text-hi | `text-white` / `#F5F1E8` | `#F5F1E8` | Заголовки (warm off-white) |
| text-body | `.text-body` | `#B8AE97` | Основной текст |
| text-muted | `.text-muted` | `#7A7362` | Вспомогательный текст |
| brand-500 | `brand-500` | `#F59E0B` | Основной акцент (amber) |
| brand-600 | `brand-600` | `#D97706` | Акцент hover/dark |
| brand-400 | `brand-400` | `#FBBF24` | Ring focus / hover |
| glow | `.glow` | — | amber box-shadow для CTA |

### Ключевые CSS-классы (index.css)

```css
.card          /* solid карточка: bg #1A1712, border #2E2820 */
.card-hover    /* hover: bg #221E17, border #4A402F */
.card-glass    /* glassmorphism для hero-оверлеев */
.text-gradient /* amber gradient text для заголовков */
.glow          /* amber box-shadow для CTA */
.glow-sm       /* меньший glow */
.text-body     /* цвет #B8AE97 */
.text-muted    /* цвет #7A7362 */
```

### Типографика

- Шрифт: Inter (UI), JetBrains Mono (код/числа) — подключены в `index.html`
- Заголовки: `text-white font-bold`, `style={{ textWrap: 'balance' }}`
- Описания: `text-body` (`#B8AE97`)
- Подписи/лейблы: `text-muted` (`#7A7362`)
- Числа в таблицах: `font-variant-numeric: tabular-nums`
- Иконки декоративные: `aria-hidden="true"`

### ParticleBackground

```jsx
<ParticleBackground />
// Абсолютно позиционированный canvas, aria-hidden
// Автоматически отключается при prefers-reduced-motion: reduce
// Используется в Hero и CTA секциях Landing
```

---

## Архитектура после Phase 2–5

**Backend:**
- `logging_config.py` — структурированное логирование (human в dev, JSON в prod), вызывается в `main.py` до старта FastAPI.
- `auth/rate_limit.py` — in-memory rate limiter (10 логинов/5мин, 5 регистраций/час на IP). Для кластеров нужен Redis-backend.
- `files/validators.py` — проверка magic bytes для PDF (`%PDF-`) и DOCX (`PK\x03\x04`), не только Content-Type.
- `models.py` — индексы на `orders.user_id`, `orders.status`, `orders.stripe_session_id`, `orders.stripe_payment_intent`, `orders.created_at`, `uploaded_files.order_id`.
- `main.py` — middleware логирует каждый HTTP-запрос, `/health` отдаёт `dev_mode` для синхронизации фронта.

**Frontend:**
- `components/layout/ErrorBoundary.jsx` — глобальный error boundary, оборачивает `<App>`.
- `components/ui/TopProgressBar.jsx` — тонкий янтарный прогрессбар (градиент + блик), активируется на route transitions и React Query fetching/mutating.
- `store/index.js` — `persist.partialize` хранит только form-поля, `orderId`/`currentStep` живут только в runtime-стейте.
- `api/client.js` — refresh-token через единый `refreshPromise`, корректно работает при параллельных 401.
- `hooks/index.js` — `useGenerationStatus` использует exponential-ish backoff для polling (2.5s → 5s → 10s).

## Безопасность конфига (после Phase 1)

- `SECRET_KEY` обязателен в production (валидатор в `config.py` падает если пустой). В DEV_MODE — авто-генерируется с предупреждением.
- `COOKIE_SECURE` по умолчанию `True`. `False` разрешён только при `DEV_MODE=True`.
- `COOKIE_SAMESITE` настраивается через ENV (`lax`/`strict`/`none`).
- `DEV_TOKEN` обязателен для `/dev/*` эндпоинтов. Клиент передаёт в заголовке `X-Dev-Token`. Фронт читает из `VITE_DEV_TOKEN`.
- Stripe webhook идемпотентен: повторный `payment_intent` или статус не `pending` → no-op.

## Важные архитектурные правила

1. **Цены только на бэке.** `TIERS` в `config.py` — единственный источник. Никогда не хардкодить цены в JSX.

2. **Webhook — единственный источник правды для оплаты.** `success_url` параметры игнорируются.

3. **Celery использует синхронный psycopg2.** В `tasks.py`: `+asyncpg` → `+psycopg2`, `+aiosqlite` → убирается.

4. **Mock-генератор всегда работает.** Без Anthropic API ключа и без кода бота — весь флоу проходит.

5. **JWT в httpOnly cookies.** Никогда не хранить токены в localStorage.

6. **Файлы по UUID.** Имена файлов на диске — UUID, не оригинальные имена.

7. **CORS с credentials.** `allow_credentials=True` + конкретный origin, не `*`.

8. **`_fix_cyrillic_charset` патчит ВСЕ XML файлы PPTX.** Не только слайды — мастера, лейауты, тема тоже имеют `charset="0"`.

9. **Палитра всегда задана.** Дефолт `midnight_executive` в store, `getFormData()` и `_assemble_plan`. Пустая строка ломает цвет.

10. **Навигация через `<Link>`, не `<button onClick navigate>`.** Поддержка Cmd+Click, правой кнопки.

11. **Тёмная тема через CSS в `body`, не `@apply`.** Tailwind не сканирует CSS-файлы, `@apply bg-[#hex]` не генерируется JIT.

12. **Solid карточки, не glassmorphism.** `#1A1712` + `border #2E2820` (warm-dark) — читаемо на тёмном фоне. Glassmorphism только для hero-оверлеев.

---

## Тарифы

| ID | Название | Цена | Модель | Слайды |
|----|---------|------|--------|--------|
| basic | Базовый | $3.00 | claude-sonnet-4-6 | 12 |
| standard | Стандарт | $6.00 | claude-sonnet-4-6 | 20 |
| premium | Премиум | $12.00 | claude-opus-4-6 | 30 |

---

## Статусы заказа

```
pending → paid → generating → done
                            ↘ failed
```

---

## Палитры презентаций

| ID | Название | Цвет |
|----|---------|------|
| midnight_executive | Midnight Executive | Тёмно-синий (дефолт) |
| forest_moss | Forest & Moss | Зелёный |
| coral_energy | Coral Energy | Красно-коралловый |
| warm_terracotta | Warm Terracotta | Терракотовый |
| ocean_gradient | Ocean Gradient | Синий-морской |
| charcoal_minimal | Charcoal Minimal | Угольный |
| teal_trust | Teal Trust | Бирюзовый |
| berry_cream | Berry & Cream | Бордовый |
| sage_calm | Sage Calm | Мятный |
| cherry_bold | Cherry Bold | Тёмно-красный |

---

## Известные нюансы

### Кириллица в .pptx
pptxgenjs ставит `charset="0"` в `<a:latin>` тегах — кириллица не рендерится.
Решение: `_fix_cyrillic_charset()` патчит **все `.xml` файлы** в ZIP.
Функция `t()` в pptxgen.js удаляет `fontFace` → нет явных шрифтов → меньше проблем с charset.
Вопросики — это charset, не отсутствие API ключа.

### Без ANTHROPIC_API_KEY
Используется `_generate_placeholder()` — русский текст-заглушка.
Весь флоу (форма → оплата → скачивание) работает.
Для реального контента: добавить `ANTHROPIC_API_KEY` в `.env`.

### Dev-режим оплаты
`DEV_MODE=True` + `CELERY_TASK_ALWAYS_EAGER=True`:
- На странице `/payment` появляется кнопка "Симулировать оплату"
- Вызывает `POST /dev/complete-payment/{order_id}`
- Сразу запускает генерацию без Stripe

### Загрузка файла
FileUpload доступен на странице `/payment` (после создания заказа).
В Wizard показывается только если `orderId` уже есть (из предыдущей сессии persist).
