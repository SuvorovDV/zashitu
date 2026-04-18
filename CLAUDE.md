# CLAUDE.md — монорепа Tezis (ZaShitu)

> Этот файл читай ПЕРВЫМ в каждой новой сессии.

---

## Что это за проект

**ZaShitu** — платформа для генерации академических презентаций (.pptx) по загруженной работе студента. Два канала, один бэкенд:

- **Telegram-бот** (`@ai_presentations_test_bot`) — FSM-диалог 10 шагов → Stars → .pptx
- **Веб-приложение** (React SPA) — регистрация → форма → Stripe → .pptx

Оба канала ходят в общий FastAPI-бэкенд. Тонкий клиент — в `bot/`, толстый — в `frontend/`, сам бэкенд — в `backend/`.

**Главное отличие от Gamma:** генерация **по работе студента** (`source_grounded`), каждый тезис с ссылкой на страницу. Никаких галлюцинаций.

**Pipeline слайдов (итерирован 2026-04-17 → 2026-04-18):**
1. **Scenario A (user has speech text):** если юзер в wizard Step 9 отметил «да, вставлю свою» — `user_speech_text` копируется в `speech_text`, `speech_approved=True` авто-выставляется, Claude-генерация речи пропускается. Сразу идём к skeleton+slides.
2. **Scenario B (generate speech):** если `include_speech` и речь не предоставлена — `_generate_speech` вызывает Claude, юзер ревьюит/аппрувит.
3. После аппрува речи (обоих сценариев) → `_derive_skeleton_from_speech` просит Claude предложить titles+layouts **под реальные секции речи** (не фиксированный пул).
4. `_generate_with_claude` заполняет контент. **System prompt переработан (2026-04-18, коммит `24718fd`):** named entities pass (ФИО/города/компании/проценты), density floor (число или сущность на каждом слайде), fact integrity (ни одного числа вне источника в strict-режиме), layout decision tree (≥3 числа → stats, временной ряд → chart, ≥3 строк → table). 3 few-shot примера плотных слайдов в промте. `allow_enhance=True` (юзер разрешил) ослабляет fact-integrity — Claude может добавить общие знания, но маркер «общее знание» на практике использует редко (см. DECISIONS.md «Enhance-режим…»).
5. **NER-валидатор** (`2ce92b1`) — regex-бэкстоп над content слайдов, грепает топонимы/аббревиатуры/числа/годы/ФИО, сверяет со стеммленным source через `_entity_present_in_source`. Warn-only, список `hallucinated_entities` пишется в `orders.generation_prompt` для наблюдаемости. Env-flag `NER_VALIDATE_ENABLED` (default True).
6. `_generate_images_for_slides` — SVG-декор в углу через Claude, растеризация через `@resvg/resvg-js`.
7. `pptxgen.js` собирает `.pptx` + footer `sourceFooter(prs, slide, s)` на ВСЕХ content-layouts (callout/two_col/stats/table/chart/image_side/default) — core USP «ссылка на источник». Content-area сжата с 5.25" до 5.0" чтобы зарезервировать место под footer.
8. `/files/download-speech/{id}` отдаёт речь с маркерами `=== Слайд N: title ===` (sonnet-4-6, кэш в `outputs/`).

**Slide count derivation (`34aa4e5`):** `slides_count` явно → используется; иначе `duration_minutes × 1.1` с clamp к `tier.max_slides`. Раньше при выборе «по длительности» брался tier default (30 слайдов на premium) — юзер просил 10 мин, получал 32 слайда. Починено.

**Фронтенд (редизайн 2026-04-18, orange 2026-04-18 вечер):** все страницы в эстетике **dark `#0E0E0C` + orange accent `#FF5C2A` + cream ink `#FFF8EE` + Instrument Serif + маскот «научрук»**. Изначально был lime `#C8FF3E` из handoff-bundle Claude Design, user заменил на orange после ревью. Wizard Step 9 переработан (`55d9f7f`): две оси выбора — «у меня есть речь / сгенерируйте» + «строго / разрешаю дополнить». Работу можно не загружать, можно вставить готовую речь, можно оба. Landing hero/process/modes/features переписаны под новые сценарии (`a49cb63`). Mobile-responsive сетка (`ca8e3a1`).

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
│   ├── deploy.md          ← рунбук по текущему проду (FirstVDS)
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
| AI | Anthropic Python SDK. Basic/standard — `claude-sonnet-4-6`, premium — `claude-opus-4-7`. Разметка речи на скачивании всегда sonnet. |
| Генерация .pptx | `pptxgen.js` (Node subprocess из Python) — layout-ы default/callout/two_col/section/quote/stats/table/chart + SVG-декор в углу (растеризация через `@resvg/resvg-js`). LibreOffice + pdftoppm для превью-PNG. |
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
- Веб (текущий): `https://tezis.176.12.79.36.nip.io` (Caddy + nip.io-домен, авто-TLS)
- Веб (планируется): `https://get-tezis.ru` — выбран 2026-04-18, Caddyfile уже готов в `9cdd0ad`. Ждём покупку домена на REG.RU и DNS A-записи. После propagation — обновить `deploy/.env.prod` (`ALLOWED_HOSTS`, `FRONTEND_URL`) и rebuild frontend+backend.
- Бот: `@ai_presentations_test_bot` (Telegram)

**Код на VM:** `~/zashitu/` (копия монорепы через git — с 2026-04-18 `git pull` работает), запускается из `~/zashitu/deploy/docker-compose.prod.yml` с `-p deploy`, env из `deploy/.env.prod` (chmod 600).

**Известные компромиссы (пока MVP):**
- Stripe не сконфигурирован → чекаут 503 (работает Stars через бота, но `/payments/checkout` на вебе отключён)
- `DEV_MODE=True` на проде — оставлено, т.к. нужна кнопка «симулировать оплату» в UI пока Stripe не подключён. Перед публичным запуском выключить.
- Юрлицо не оформлено — в футере плейсхолдер «ООО «Тезис»» без ИНН/ОГРН.

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
- **Прод-домен (текущий):** `https://tezis.176.12.79.36.nip.io`
- **Прод-домен (планируется):** `https://get-tezis.ru` (после покупки на REG.RU + DNS A-записей)
- **Старый сервер (Yandex Cloud):** `erkobrax@111.88.153.18` — выключен, можно удалять
- **Compose project name:** `deploy` (контейнеры `deploy-*`, volumes `deploy_*`)
