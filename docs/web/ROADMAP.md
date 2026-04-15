# ROADMAP — рефакторинг + редизайн

Связано: `REVIEW.md` (60 проблем), `PROGRESS.md` (история), `DECISIONS.md` (архитектурные решения), `CLAUDE.md` (контекст).

Статус на 2026-04-14 после сессии #2.

---

## ✅ Сделано

### Phase 1 — Документы, палитра Янтарь, CRITICAL
- [x] `REVIEW.md`, `ROADMAP.md`
- [x] Палитра Янтарь в `CLAUDE.md`, `tailwind.config.js`, `index.css`, `index.html`, `ParticleBackground.jsx`
- [x] Bulk-замена холодных хексов (`#0D0D1A`→`#0F0E0B`, `#131328`→`#1A1712`, …) во всех `.jsx`/`.js` фронта
- [x] `SECRET_KEY` валидация (auto-gen в dev, обязателен в prod)
- [x] `COOKIE_SECURE`/`COOKIE_SAMESITE` из env, secure cookies
- [x] `/dev/*` требует `X-Dev-Token` (constant-time сравнение)
- [x] Stripe webhook идемпотентен (повторный `payment_intent` / не-pending → no-op)
- [x] `.env.example` / `.env` обновлены

### Phase 2 — Backend (частично)
- [x] Индексы на `orders.user_id`, `orders.status`, `orders.stripe_session_id`, `orders.stripe_payment_intent`, `orders.created_at`, `uploaded_files.order_id`
- [x] `logging_config.py` — структурированное логирование (human в dev, JSON в prod)
- [x] HTTP-middleware логирует каждый запрос
- [x] `auth/rate_limit.py` — in-memory rate limiter (10 login/5min, 5 register/час на IP)
- [x] `files/validators.py` — magic bytes (`%PDF-`, `PK\x03\x04`)
- [x] `/health` отдаёт `dev_mode`

### Phase 3 — Frontend (частично)
- [x] `ErrorBoundary` оборачивает `<App>`
- [x] `TopProgressBar` — градиент + glow + бегущий блик, активен на React Query fetching/mutating + route transitions
- [x] `store/index.js` — `persist.partialize` хранит только form-поля; `orderId`/`currentStep` не персистятся
- [x] `api/client.js` — единый `refreshPromise` для concurrent 401
- [x] `useGenerationStatus` — exponential-ish backoff polling (2.5s→5s→10s)
- [x] `Navbar.logout` — убран bare catch, `removeQueries(['auth','me'])`

### Phase 4 — Визуал (частично)
- [x] Hero без `ParticleBackground` и `bg-dot-grid`
- [x] Радиальные gradients переведены с фиолета на янтарь (Landing/Login/Register)
- [x] Тариф «Выбрать» на непопулярных — outline brand-500 (контрастнее фона)
- [x] `Button.jsx` — primary amber с тёмным текстом, добавлен `outline` вариант
- [x] `Spinner.jsx` — `role="status"`, `aria-live="polite"`, sr-only label
- [x] Убраны все упоминания Claude/Anthropic (Landing hero-badge, features, tiers, footer, Payment)

---

## ❌ НЕ сделано — начать отсюда в следующей сессии

### Phase 2 (Backend) — осталось

**Репозиторный слой (router → service → repository):**
- [ ] `auth/repository.py` — вынести все SQL-запросы из `auth/service.py` (сейчас сервис напрямую дёргает `db.execute(select(User)...)`)
- [ ] `orders/repository.py` — то же для `orders/service.py`
- [ ] `payments/repository.py`, `files/repository.py`, `generation/repository.py`
- [ ] Service-слой должен принимать repository, не `AsyncSession`
- [ ] Router — только HTTP, без бизнес-логики. Сейчас `orders/router.py:126-130` мутирует `order.tier` напрямую, это работа сервиса

**Alembic миграции:**
- [ ] `alembic init backend/alembic`
- [ ] Настроить `env.py` с async engine + `target_metadata = Base.metadata`
- [ ] Baseline миграция (все текущие таблицы + индексы)
- [ ] Удалить `create_tables()` + `_add_missing_columns()` в `database.py`
- [ ] Запускать миграции в lifespan (`alembic upgrade head`) или отдельным шагом деплоя

**OrderStatus enum consistency:**
- [ ] В `models.py` колонка `status: Mapped[str]`. В `service.py:29` пишется `status=OrderStatus.pending` (enum). В `router.py:126` сравнение `order.status not in (OrderStatus.pending, "pending")`. Привести к одному виду: всегда `.value` при записи, всегда string при сравнении
- [ ] Убрать все `hasattr(order.status, "value")` — это маркер той же непоследовательности

**Прочее бэкенда:**
- [ ] `anthropic.Anthropic()` singleton в `generation/tasks.py:248`
- [ ] Pydantic schema для Claude API response (`generation/tasks.py:244-309`)
- [ ] `default_retry_delay` в Celery с exponential backoff
- [ ] Валидация `required_elements` как `List[str]` в `CreateOrderRequest`
- [ ] `psycopg2-binary` в `requirements.txt` для Celery (prod)
- [ ] Проверка пустого `STRIPE_SECRET_KEY` при инициализации
- [ ] Pathlib вместо `os.path` в `generation/tasks.py:1-8` (кроссплатформенность)

### Phase 3 (Frontend) — осталось

**Реорганизация в `features/`:**
- [ ] `src/features/auth/{components,hooks,api,store}/`
- [ ] `src/features/wizard/{components,hooks,api,store,Wizard.jsx}/`
- [ ] `src/features/payment/`, `src/features/generation/`, `src/features/dashboard/`
- [ ] `src/shared/ui/` — Button, Input, Spinner, Card, Badge, FileUpload, ParticleBackground, TopProgressBar, ErrorBoundary
- [ ] `src/shared/api/client.js`, `src/shared/lib/`
- [ ] Удалить плоские `pages/`, `components/`, `hooks/`, `store/`, `api/`

**Sync фронта с бэком по dev_mode:**
- [ ] `VITE_DEV_MODE` → читать `dev_mode` из `/health` запроса (уже есть в ответе)
- [ ] Удалить `VITE_DEV_MODE` из `frontend/.env`

**Toasts/feedback:**
- [ ] Toast-провайдер (react-hot-toast или свой) — ошибки/успехи без alert()
- [ ] Заменить `window.confirm` в `Dashboard.jsx:160` на модалку с focus-trap

**Прочее фронта:**
- [ ] `Wizard.jsx` — очищать `uploaded_files` при `reset()` визарда
- [ ] `Generation.jsx` — try/catch для clipboard write в PromptInspector
- [ ] Валидация UUID на `Payment.jsx:54` перед запросом
- [ ] i18n подготовка (хотя бы вынести строки в `src/shared/i18n/ru.js`)

### Phase 4 (Визуал) — осталось

**Wizard layout:**
- [ ] Боковой прогресс-степпер слева (sticky), контент справа
- [ ] Sticky footer с «Назад / Далее»
- [ ] Унифицированный `StepField` компонент для одинаковой валидации UX
- [ ] Анимация перехода между шагами

**Компоненты:**
- [ ] `Input.jsx` — новые состояния focus/error/disabled с amber accent
- [ ] Создать `Card`, `Badge`, `Modal`, `Select`, `Textarea`
- [ ] Новая типографическая шкала (hero 56/48/40, h1–h3, body, caption)
- [ ] Шрифты: `Inter` + `JetBrains Mono` для чисел

**Landing:**
- [ ] Trust-bar секция (логотипы ВУЗов / счётчики)
- [ ] FAQ accordion
- [ ] Empty state для Dashboard ревижн

**Общее:**
- [ ] Mobile адаптация Wizard (сейчас боковой прогресс может сломаться)
- [ ] Темизация: возможность переключения amber / emerald / cyan (токены через CSS var)

### Phase 5 (HIGH + MEDIUM + тесты + a11y) — осталось

**Безопасность:**
- [ ] CSP/Security headers middleware (`X-Frame-Options`, `Strict-Transport-Security`, CSP)
- [ ] TrustedHost middleware
- [ ] Валидация UUID параметров path (сейчас в Python всё проходит, ошибки поздно)

**a11y:**
- [ ] Focus trap в модальных окнах
- [ ] Keyboard navigation Wizard (Tab/Shift+Tab, Enter для submit)
- [ ] Контраст проверить (AA/AAA) для `.text-body`/`.text-muted` на bg
- [ ] `aria-current="page"` в Navbar

**Тесты (сейчас 56 pytest + 38 vitest — не покрывают новое):**
- [ ] `test_rate_limit.py` — login/register limit работает, `Retry-After` правильный
- [ ] `test_webhook_idempotency.py` — повторный Stripe webhook → no-op
- [ ] `test_magic_bytes.py` — подделка Content-Type → 400
- [ ] `test_refresh_queue.js` — concurrent 401, один refresh запрос на всех
- [ ] `test_error_boundary.jsx` — падение ребёнка ловится, показывается fallback
- [ ] `test_dev_token.py` — `/dev/*` без `X-Dev-Token` → 401
- [ ] Обновить существующие тесты под новую сигнатуру `_set_auth_cookies` (COOKIE_SECURE)

**Прочее:**
- [ ] Race condition на concurrent upload (`files/router.py:57-65`) — подтвердить fix, добавить тест
- [ ] TOCTOU на `FileResponse` — try/except FileNotFoundError
- [ ] `MAX_FILE_SIZE` в settings, не константа в коде
- [ ] `ParticleBackground` feature detection (canvas poly) + fallback
- [ ] Обновить `PROGRESS.md` после каждой новой сессии

---

## Подводные камни на старте новой сессии

1. **БД удалена 2026-04-14**. Новый старт пересоздал её с новыми индексами. Если есть локальные старые заказы — они пропали (это было согласовано).
2. **Frontend порт 5181** — 5173–5180 заняты старыми vite-процессами. CORS бэка настроен на 5173, поэтому API-запросы с 5181 ломаются. Либо `taskkill /F /IM node.exe` перед стартом, либо прописать 5181 в `FRONTEND_URL` временно.
3. **`DEV_TOKEN` в `.env`** = `dev_local_token_replace_me`, фронт читает `VITE_DEV_TOKEN` с тем же значением. В prod обязательно заменить оба.
4. **`SECRET_KEY` в dev auto-generated каждый старт** → при рестарте бэка все старые JWT инвалидятся. Пользователя выкинет. Для стабильного dev — задать явно в `.env`.
5. **Backend не запускается с `--reload`** (watchfiles почему-то падает на Windows). Запускай без `--reload`.
6. **Тесты не запускались после рефакторинга Phase 2–5.** Скорее всего часть сломана (изменилась сигнатура webhook-обработчика, `_set_auth_cookies`, появились новые `Depends`). Нужно прогнать и чинить.

---

## Принципы

- Коммитить после каждой фазы; каждая фаза должна оставлять проект рабочим.
- Тесты чинить вместе с рефакторингом слоёв, не после.
- Визуал делаем после архитектуры фронта: компоненты переезжают в `shared/ui` и сразу получают новый стиль.
