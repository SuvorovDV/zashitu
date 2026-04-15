# PROGRESS.md

> Обновляй этот файл после реализации каждого модуля.

---

## Сессия #3 — 2026-04-14 — Phase 2–5: завершение рефакторинга и редизайна

**Сделано:**

Phase 2a — backend quick wins:
- Anthropic singleton, Pydantic `SlideContent` для валидации ответа Claude
- `STRIPE_SECRET_KEY` guard (падаем в prod без ключа, ок в dev)
- `task_soft_time_limit`/`task_time_limit`/`retry_backoff` в Celery
- `psycopg2-binary`, `alembic`, `redis`, `anthropic` в `requirements.txt`
- `bcrypt` с явным `encoding='utf-8'`
- pathlib в `generation/tasks.py`, `PYTHONIOENCODING=utf-8` для Node
- zipfile path-traversal защита в `_fix_cyrillic_charset`
- `MAX_FILE_SIZE_MB` в settings (дефолт 20)
- TOCTOU fix в `/files/download` (try/except FileNotFoundError)

Phase 2b — OrderStatus enum + Alembic:
- Везде `.value` при записи, строковое сравнение при чтении; убрали `hasattr(..., "value")`
- `backend/alembic.ini`, `alembic/env.py`, `versions/0001_baseline.py` (async-совместимая конфигурация)
- `database.py` очищен от `_add_missing_columns`, `create_tables` оставлен как dev-fallback

Phase 2c — repository слой:
- `auth/repository.py`, `orders/repository.py`, `files/repository.py`
- Сервисы используют репозиторий; `update_order_tier` вытащен из роутера в сервис

Phase 3a — frontend quick wins:
- `useDevMode()` хук (читает `/health`), заменил `VITE_DEV_MODE`
- `src/lib/uuid.js` + валидация UUID на `Payment`, `Generation`
- `Toast` провайдер + `ConfirmDialog` (focus trap + Esc)
- `alert/confirm` → `Modal`/`Toast` (Dashboard, Generation, Payment)
- `i18n/ru.js` — централизованные строки
- Network-error handling в Login/Register (429/ERR_NETWORK)
- `aria-current="page"` в Navbar; `role="status"` на Dashboard loading

Phase 3b — features/ реорганизация (barrel-реэкспорты):
- `src/shared/ui/index.js`, `src/shared/api/index.js`
- `src/features/{auth,wizard,generation,payment,dashboard}/index.js`
- Плоские `pages/components/hooks/store/api/` пока остаются для совместимости

Phase 4 — Wizard редизайн + компоненты:
- Inter + JetBrains Mono в `index.html` + `tailwind.config.js`
- `Card`, `Badge`, `Textarea`, `Select` — новые компоненты в `components/ui/`
- `Input` переписан с `useId`, `aria-invalid`, `aria-describedby`
- `WizardSidebar` — sticky sidebar с 10 шагами, клавиатура, `aria-current="step"`
- `Wizard.jsx` — sidebar + sticky footer + fade-анимация между шагами
- Mobile: сайдбар скрыт, на его месте `WizardProgress`

Phase 5 — security + a11y + тесты:
- `security_headers.py` + `SecurityHeadersMiddleware` (CSP, HSTS, XFO, XCTO, Referrer, Permissions)
- `TrustedHostMiddleware` с настройкой `ALLOWED_HOSTS`
- **Новые тесты backend** (13 штук): `test_rate_limit.py`, `test_magic_bytes.py`, `test_dev_token.py`, `test_security_headers.py`, `test_webhook_idempotency.py`
- **Новые тесты frontend** (8 штук): `uuid.test.js`, `ErrorBoundary.test.jsx`
- Сброс rate-limiter bucket'ов в `conftest.py` (autouse)
- Итог: **69 backend тестов + 46 frontend тестов — все зелёные**

**Новые файлы backend:** `alembic.ini`, `alembic/env.py`, `alembic/script.py.mako`, `alembic/versions/0001_baseline.py`, `security_headers.py`, `auth/repository.py`, `orders/repository.py`, `files/repository.py`, 5 test-файлов.

**Новые файлы frontend:** `components/ui/{Toast,Modal,Card,Badge,Textarea,Select}.jsx`, `components/wizard/WizardSidebar.jsx`, `lib/uuid.js`, `shared/{ui,api,i18n}/...`, `features/{auth,wizard,generation,payment,dashboard}/index.js`, 2 test-файла.

**Что НЕ сделано (осталось для будущих сессий):**
- Полная миграция фронта в `features/` (barrel-реэкспорты уже есть, плоские пути тоже; нужно руками переместить файлы и обновить импорты)
- Мобильный UX Wizard (sidebar скрыт, но степы не все протестированы на маленьком экране)
- Trust-bar / FAQ accordion / новая typography scale — базовые Inter/JetBrains Mono подключены, но hero/display-сайзы в Landing ещё не применены
- Полное покрытие тестами refresh-queue concurrent 401 на фронте (сложный мок)
- UUID-валидация path-параметров на бэке (на фронте уже есть)

---

## Сессия #2 — 2026-04-14 — Палитра Янтарь + CRITICAL + частичный рефакторинг

**Сделано:** см. `ROADMAP.md` разделы ✅ Phase 1–5 (частично). Кратко:
- Палитра переведена с фиолета на янтарь (`#F59E0B`), warm-dark surfaces.
- CRITICAL security: SECRET_KEY валидация, secure cookies из env, DEV_TOKEN для `/dev/*`, Stripe webhook идемпотентность.
- Backend: индексы в БД, structured logging, rate limiter, magic bytes, HTTP middleware.
- Frontend: ErrorBoundary, TopProgressBar, refresh-queue fix, store partialize, polling backoff.
- Удалены все упоминания Claude/Anthropic из UI.

**Новые файлы:**
- `REVIEW.md` (60 проблем)
- `ROADMAP.md` (план фаз со статусом)
- `backend/logging_config.py`
- `backend/auth/rate_limit.py`
- `backend/files/validators.py`
- `frontend/src/components/layout/ErrorBoundary.jsx`
- `frontend/src/components/ui/TopProgressBar.jsx`

**Что НЕ сделано — см. `ROADMAP.md` раздел ❌.** Главное: репозиторный слой, Alembic, `features/` реорганизация, Wizard редизайн, тесты.

**Инфраструктурное:** удалена `backend/zashitu.db`; новая с индексами создаётся при старте.

---

## Статус модулей

### Инфраструктура
| Файл | Статус | Примечание |
|------|--------|-----------|
| docker-compose.yml | ✅ | PostgreSQL 15 + Redis 7 |
| .env.example | ✅ | Все переменные задокументированы |
| .env | ✅ | SQLite + memory broker для локальной разработки |

### Бэкенд
| Модуль | Файл | Статус |
|--------|------|--------|
| Config | backend/config.py | ✅ |
| Database | backend/database.py | ✅ |
| Models | backend/models.py | ✅ |
| Celery | backend/celery_app.py | ✅ |
| FastAPI app | backend/main.py | ✅ |
| Auth service | backend/auth/service.py | ✅ |
| Auth dependencies | backend/auth/dependencies.py | ✅ |
| Auth router | backend/auth/router.py | ✅ |
| Orders service | backend/orders/service.py | ✅ |
| Orders router | backend/orders/router.py | ✅ |
| Payments service | backend/payments/service.py | ✅ |
| Payments router | backend/payments/router.py | ✅ |
| Generation tasks | backend/generation/tasks.py | ✅ |
| Generation service | backend/generation/service.py | ✅ |
| Generation router | backend/generation/router.py | ✅ |
| Files service | backend/files/service.py | ✅ |
| Files router | backend/files/router.py | ✅ |
| Dev router | backend/dev_router.py | ✅ |
| pptxgen.js | backend/generation/pptxgen.js | ✅ |
| requirements.txt | backend/requirements.txt | ✅ |

### Бэкенд — тесты
| Файл | Статус | Тестов |
|------|--------|--------|
| backend/tests/conftest.py | ✅ | SQLite in-memory + httpx client |
| backend/tests/test_auth_service.py | ✅ | 18 |
| backend/tests/test_auth_router.py | ✅ | 13 |
| backend/tests/test_orders_service.py | ✅ | 25 |
| **Итого** | ✅ | **56 тестов, все зелёные** |

Запуск: `cd backend && python -m pytest tests/ -v`

### Фронтенд
| Модуль | Файл | Статус |
|--------|------|--------|
| Vite config | frontend/vite.config.js | ✅ |
| Tailwind config | frontend/tailwind.config.js | ✅ |
| package.json | frontend/package.json | ✅ |
| index.html | frontend/index.html | ✅ |
| CSS / дизайн-система | frontend/src/index.css | ✅ |
| API client | frontend/src/api/client.js | ✅ |
| API functions | frontend/src/api/index.js | ✅ |
| Stores | frontend/src/store/index.js | ✅ |
| Hooks | frontend/src/hooks/index.js | ✅ |
| Navbar | frontend/src/components/layout/Navbar.jsx | ✅ |
| ProtectedRoute | frontend/src/components/layout/ProtectedRoute.jsx | ✅ |
| Button | frontend/src/components/ui/Button.jsx | ✅ |
| Input | frontend/src/components/ui/Input.jsx | ✅ |
| Spinner | frontend/src/components/ui/Spinner.jsx | ✅ |
| FileUpload | frontend/src/components/ui/FileUpload.jsx | ✅ |
| ParticleBackground | frontend/src/components/ui/ParticleBackground.jsx | ✅ |
| WizardProgress | frontend/src/components/wizard/WizardProgress.jsx | ✅ |
| Шаги 1–10 | frontend/src/components/wizard/steps/ | ✅ |
| Landing | frontend/src/pages/Landing.jsx | ✅ |
| Login | frontend/src/pages/Login.jsx | ✅ |
| Register | frontend/src/pages/Register.jsx | ✅ |
| Dashboard | frontend/src/pages/Dashboard.jsx | ✅ |
| Wizard | frontend/src/pages/Wizard.jsx | ✅ |
| Payment | frontend/src/pages/Payment.jsx | ✅ |
| Generation | frontend/src/pages/Generation.jsx | ✅ |
| NotFound | frontend/src/pages/NotFound.jsx | ✅ |

### Фронтенд — тесты
| Файл | Статус | Тестов |
|------|--------|--------|
| frontend/src/__tests__/store.test.js | ✅ | 20 |
| frontend/src/__tests__/Button.test.jsx | ✅ | 11 |
| frontend/src/__tests__/api.test.js | ✅ | 7 |
| **Итого** | ✅ | **38 тестов, все зелёные** |

Запуск: `cd frontend && npm test`

---

## История изменений

### Фиксы генерации (актуально)

**Вопросики вместо кириллицы** — `_fix_cyrillic_charset()` патчила только `ppt/slides/slide*.xml`.
pptxgenjs также пишет `charset="0"` в `ppt/slideMasters/`, `ppt/slideLayouts/`, `ppt/theme/` —
они не патчились, кириллица в тексте ломалась.
Фикс: теперь патчатся **все `.xml` файлы** внутри PPTX zip-архива.

**Неверная палитра (всегда голубая)** — `wizardDefaults.palette = ''`, `getFormData()` возвращал
`palette: undefined` при пустой строке, бэкенд писал `NULL`, генератор фоллбэчил на `"blue"`.
Фикс: дефолт `'midnight_executive'` в store, `getFormData()` и `_assemble_plan`.

---

### Полный редизайн UI (актуально)

Новая дизайн-система — solid surfaces вместо glassmorphism:

| Токен | Значение | Назначение |
|-------|----------|-----------|
| bg | `#0D0D1A` | Фон приложения |
| surface | `#131328` | Фон карточек |
| surface-raised | `#1A1A38` | Hover-состояние карточек |
| border | `#242448` | Граница карточек |
| border-hi | `#363668` | Граница при hover |
| text-hi | `#F0F0FF` | Заголовки |
| text-body | `#ADADCC` | Основной текст |
| text-muted | `#686898` | Вспомогательный текст |
| brand | `#7C3AED` | Фиолетовый акцент |

**Что изменилось vs предыдущий дизайн:**
- `card-glass` (opacity 0.04–0.07, едва заметные) → `.card` — solid `#131328` с видимой границей
- `text-gray-400/500` → `#ADADCC` (контраст 7.5:1 вместо 4.1:1)
- Все заголовки: `text-wrap: balance` / `text-pretty`
- Цены: `font-variant-numeric: tabular-nums`
- Декоративные иконки: `aria-hidden="true"` везде
- Переходы: `transition-colors duration-200` вместо `transition: all`
- `ParticleBackground` — canvas с частицами + `prefers-reduced-motion`
- Hero: радиальный фиолетовый градиент + частицы + dot-grid
- `index.html`: `color-scheme: dark`, `theme-color`

**Исправлены нарушения Web Guidelines:**
- `<button onClick navigate>` → `<Link to>` в Navbar (Cmd+click теперь работает)
- Кнопка удаления в Dashboard получила `aria-label`
- Все формы: `htmlFor`+`id`, `autocomplete`, `aria-live="polite"` на ошибках

---

### Добавлены тесты

**Backend** (pytest + pytest-asyncio):
- SQLite in-memory через `StaticPool` — изоляция каждого теста
- FastAPI `dependency_overrides` — подменяет реальную БД на тестовую
- Покрытие: хеширование паролей, JWT, регистрация, логин, заказы (CRUD)

**Frontend** (vitest + @testing-library/react):
- wizardStore — 20 тестов на навигацию, setField, reset, getFormData
- Button — 11 тестов на рендер, disabled/loading, onClick, варианты
- API модули — 7 тестов на экспорты и downloadUrl

---

### pptxgen.js — фикс ReferenceError (ранее)
- `FONT_TITLE` и `FONT_BODY` не были объявлены → `ReferenceError` при генерации
- Добавлено: `const FONT_TITLE = null; const FONT_BODY = null;`
- `t()` удаляет `fontFace` перед передачей в pptxgenjs

---

## Быстрый запуск (локально, без Docker)

```bash
# .env уже настроен для локальной разработки:
# - SQLite вместо PostgreSQL
# - memory broker вместо Redis
# - CELERY_TASK_ALWAYS_EAGER=True (без воркера)
# - DEV_MODE=True (кнопка симуляции оплаты)

# Бэкенд
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000

# Фронтенд (отдельный терминал)
cd frontend
npm install
npm run dev

# Открыть: http://localhost:5173
```

## Известные ограничения MVP

- Google OAuth не реализован
- Email-подтверждение не реализован (`is_verified=True` сразу)
- Файлы хранятся локально (не S3/R2)
- Нет rate limiting
- Без `ANTHROPIC_API_KEY` — генерация через placeholder (без реального Claude)
- Загрузка файла доступна только после создания заказа (на шаге `/payment`)
