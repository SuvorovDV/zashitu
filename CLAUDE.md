# CLAUDE.md — монорепа ZaShitu

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
├── deploy/                ← Docker и прокси
│   ├── Dockerfile.bot Dockerfile.backend Dockerfile.frontend
│   ├── docker-compose.prod.yml   ← полный прод-стек (bot + backend + worker + frontend + db + redis)
│   ├── Caddyfile nginx.conf
├── docs/
│   ├── deploy-yandex.md   ← текущий прод-деплой (только бот пока)
│   └── web/               ← копии старых CLAUDE/PROGRESS/DECISIONS/ROADMAP/REVIEW от zashitu-web
├── storage/user_sessions.py  ← in-memory сессии бота
├── config.py              ← bot env: BOT_TOKEN, BACKEND_URL, TIERS (цены в Stars)
├── cloudflare-worker.js   ← прокси к api.telegram.org (для РФ-хостинга)
├── wrangler.toml
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
| Прокси TG | Cloudflare Worker (`tg-bot-proxy.erkobraxx.workers.dev`) |
| Деплой | Docker Compose, Yandex Cloud VM, Caddy (HTTPS) |

---

## Текущий статус деплоя

| Сервис | Где | Статус |
|---|---|---|
| Bot | YC VM `111.88.151.109`, контейнер `zashitu-bot-1` | ✅ работает, polling через CF Worker |
| Backend | — | ❌ не задеплоен |
| Worker (Celery) | — | ❌ не задеплоен |
| PostgreSQL + Redis | — | ❌ не задеплоены |
| Frontend | — | ❌ не задеплоен |

Пока бэкенд не поднят, бот проходит FSM, но падает на первом `POST /orders/`. Следующий большой шаг — поднять `deploy/docker-compose.prod.yml` на той же VM.

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
- **VM:** `erkobrax@111.88.151.109` (соседствует с `tg_bot_ATP`)
- **Путь на VM:** `~/zashitu` (залит через scp; git на VM не настроен)
- **TG-прокси:** `https://tg-bot-proxy.erkobraxx.workers.dev` (reuse от ATP)

Подробнее — `docs/deploy-yandex.md`.
