# CLAUDE.md — монорепа Tezis (ZaShitu)

> Этот файл читай ПЕРВЫМ в каждой новой сессии.

---

## Что это за проект

**ZaShitu** — платформа для генерации академических презентаций (.pptx) по загруженной работе студента. Два канала, один бэкенд:

- **Telegram-бот** (`@ai_presentations_test_bot`) — FSM-диалог 10 шагов → Stars → .pptx
- **Веб-приложение** (React SPA) — регистрация → форма → Stripe → .pptx

Оба канала ходят в общий FastAPI-бэкенд. Тонкий клиент — в `bot/`, толстый — в `frontend/`, сам бэкенд — в `backend/`.

**Главное отличие от Gamma:** генерация **по работе студента** (`source_grounded`), каждый тезис с ссылкой на страницу. Никаких галлюцинаций.

---

## Структура монорепы

```
zashitu/
├── CLAUDE.md              ← этот файл (корневой индекс)
├── PROGRESS.md            ← статус деплоя и интеграции каналов
├── DECISIONS.md           ← решения уровня монорепы
├── bot/                   ← Telegram-бот (aiogram 3)
│   ├── main.py, api_client.py, handlers/, keyboards/, states.py
│   └── requirements.txt
├── backend/               ← FastAPI + Celery (zashitu-web/backend)
│   ├── main.py, models.py, config.py
│   ├── auth/ orders/ payments/ generation/ files/
│   ├── alembic/           ← миграции
│   └── requirements.txt
├── frontend/              ← React + Vite + Tailwind
│   ├── src/ index.html package.json vite.config.js
├── deploy/                ← Docker
│   ├── Dockerfile.bot Dockerfile.backend Dockerfile.frontend
│   ├── docker-compose.prod.yml   ← полный прод-стек (bot + backend + worker + frontend + db + redis)
│   ├── Caddyfile
├── docs/
│   ├── deploy-yandex.md   ← старые заметки по деплою (Yandex Cloud, исторические)
│   └── web/               ← копии старых CLAUDE/PROGRESS/DECISIONS/ROADMAP/REVIEW от zashitu-web
├── storage/user_sessions.py  ← in-memory сессии бота
├── config.py              ← bot env: BOT_TOKEN, BACKEND_URL, TIERS (цены в Stars)
├── docker-compose.yml     ← корневой (сейчас = только bot для VM)
├── .env / .env.example    ← общий: ключи бота + бэкенда
├── architecture_v5.md roadmap_v3.md   ← старые продуктовые доки бота
```

`bot/` и `backend/` — два разных Python-процесса с отдельными `requirements.txt`. Общий только `.env` и git-история.

---

## Контракт бот ↔ бэкенд

Бот — тонкий клиент. Все вызовы — через `bot/api_client.py` с заголовком `X-Bot-Secret` (значение из `BACKEND_INTERNAL_SECRET`):

- `POST /orders/` — создать заказ
- `POST /files/upload/{order_id}` — PDF/DOCX
- `POST /payments/internal/confirm` — после Stars
- `GET /generation/status/{order_id}` — поллинг
- `GET /files/download/{order_id}` — забрать .pptx

**Важно:** в `bot/config.py → TIERS` цены в Stars, в `backend/config.py → TIERS` — в центах/рублях + модель Claude. Поля разные; единственное, что должно совпадать — набор **ID тарифов** (`basic`, `standard`, `premium`) и значения enum (`palette` ключи, `work_type` значения). Shared-модуль `contracts/` не создан; следить вручную, см. PROGRESS.md «Следующий шаг».

---

## Стек

| Слой | Технологии |
|---|---|
| Бот | aiogram 3.27, httpx, MemoryStorage, Docker |
| Бэкенд | FastAPI, SQLAlchemy 2 (async), Celery, PostgreSQL, Redis |
| AI | Anthropic Python SDK (Sonnet 4.6 / Opus 4.6) |
| Генерация .pptx | `pptxgen.js` (Node subprocess из Python), LibreOffice для конвертаций |
| PDF/DOCX | PyMuPDF, python-docx |
| Фронт | React 18, Vite, React Router, TanStack Query, Zustand, Tailwind |
| Оплата | Telegram Stars (бот), Stripe (веб) |
| Деплой | Docker Compose, FirstVDS KVM (Алматы), Caddy (HTTPS) |

---

## Текущий статус деплоя

Полный стек крутится на FirstVDS KVM `root@176.12.79.36` (Ubuntu 24.04, 2 ядра, 4 ГБ RAM, 60 ГБ NVMe) в одном проекте `deploy`:

| Контейнер | Образ | Состояние |
|---|---|---|
| `deploy-postgres-1` | `postgres:15-alpine` | healthy, volume `deploy_postgres_data` |
| `deploy-redis-1` | `redis:7-alpine` | healthy |
| `deploy-backend-1` | `deploy-backend` (FastAPI) | Up, uvicorn на 8000 |
| `deploy-worker-1` | `deploy-worker` (Celery) | Up |
| `deploy-frontend-1` | `deploy-frontend` (Caddy+Vite) | Up, порты 80/443 |
| `deploy-bot-1` | `deploy-bot` (aiogram) | polling напрямую в api.telegram.org |

**Публичные точки входа:**
- Веб: `https://tezis.176.12.79.36.nip.io` (Caddy + nip.io-домен, авто-TLS)
- Бот: `@ai_presentations_test_bot` (Telegram)

**Код на VM:** `~/zashitu/` (копия монорепы), запускается из `~/zashitu/deploy/docker-compose.prod.yml` с `-p deploy`, env из `deploy/.env.prod` (chmod 600).

**Известные компромиссы (пока MVP):**
- `ANTHROPIC_API_KEY` пуст → генерация возвращает placeholder (настоящей Claude-интеграции нет)
- Stripe не сконфигурирован → чекаут 503 (работает Stars через бота, но `/payments/checkout` на вебе отключён)
- `DEV_MODE=True` на проде — оставлено, т.к. нужна кнопка «симулировать оплату» в UI пока Stripe не подключён. Перед публичным запуском выключить.

---

## Как работать в этой монорепе

1. Корневые `CLAUDE.md` / `PROGRESS.md` / `DECISIONS.md` — про монорепу и интеграцию.
2. Веб-специфичные доки — `docs/web/CLAUDE.md`, `docs/web/PROGRESS.md`, `docs/web/DECISIONS.md`, `docs/web/ROADMAP.md`, `docs/web/REVIEW.md`.
3. Бот-специфичные архитектурные доки — `architecture_v5.md`, `roadmap_v3.md` в корне.
4. Меняешь контракт между ботом и бэкендом — делаешь один атомарный коммит, изменяющий обе стороны.
5. После релиза обновляй корневой `PROGRESS.md` (общий статус) и локальный (`docs/web/PROGRESS.md` если задача в вебе).

---

## Репо и прод

- **GitHub:** https://github.com/SuvorovDV/zashitu (private)
- **VM:** `root@176.12.79.36` (FirstVDS KVM, Алматы, Ubuntu 24.04, 2 ядра / 4 ГБ / 60 ГБ NVMe)
- **Доменное имя сервера:** `erkobraxx.hlab.kz`
- **Путь на VM:** `~/zashitu/`
- **Прод-домен:** `https://tezis.176.12.79.36.nip.io`
- **Старый сервер (Yandex Cloud):** `erkobrax@111.88.153.18` — выключен, можно удалять
- **Compose project name:** `deploy` (контейнеры `deploy-*`, volumes `deploy_*`)
