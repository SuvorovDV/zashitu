# CLAUDE.md — монорепа Tezis (ZaShitu)

> Этот файл читай ПЕРВЫМ в каждой новой сессии.

---

## Что это за проект

**Tezis** (legacy название ZaShitu) — платформа для генерации презентаций (.pptx) по теме. Два канала, один бэкенд:

- **Telegram-бот** (`@ai_presentations_test_bot`) — FSM-диалог 10 шагов → Stars → .pptx
- **Веб-приложение** (React SPA) — регистрация → форма → Stripe → .pptx

Оба канала ходят в общий FastAPI-бэкенд. Тонкий клиент — в `bot/`, толстый — в `frontend/`, сам бэкенд — в `backend/`.

**Pivot 2026-04-19:** проект переключился с «академической защиты по работе студента» на **школьный реферат + обычный доклад** (см. DECISIONS.md «Pivot к двум типам»). Активные типы в wizard: «Школьный реферат», «Обычный доклад». **ВКР, Курсовая, Семинар, Личный проект — заморожены** в UI как «Скоро» (academic-fallback в backend сохранён для legacy-заказов). Source-grounded режим (PDF) теперь **опциональная фича**, а не USP. Главный механизм фактической базы — **web_search через Anthropic SDK** (опирается на Росстат / Минобрнауки / NASA / профильные источники).

**Pipeline (итерирован до 2026-04-19):**

1. **Промт-фреймворк per-type** (`backend/generation/prompts/`):
   - `school_essay.py` — школьный реферат (Что/Почему/Как/Примеры/Выводы; простой тон; layouts callout/quote/section/stats; чарты редко)
   - `presentation.py` — обычный доклад (Контекст/Идея/Доказательства/Кейсы/Вывод; деловой тон; stats/chart/table — сердце дека)
   - `academic.py` — fallback для legacy типов (ВКР/Курсовая/Семинар/Личный)
   - `_shared.py` — общие блоки (JSON-схема, layout decision tree, anti-patterns, density floor, source-ref, web_search-блок) + `compose_slides_system_prompt()`, `compose_skeleton_system_prompt()`. Базовые правила синхронны между типами; структура/тон/few-shot — индивидуальные.
   - `__init__.py` — `get_prompt_module(work_type)` с фоллбэком на academic.

2. **Speech generation** (`_generate_speech`):
   - Если юзер вставил готовую речь (Step 9 «у меня есть») → копируется как-есть, `speech_approved=True` авто.
   - Иначе → Claude через `school_essay.build_speech_system_prompt` (или `presentation`).
   - **Если PDF не загружен** → подключается `web_search_20250305` server-side tool (`max_uses=3`, env-flag `WEB_SEARCH_ENABLED`). Claude ищет 2-3 авторитетных источника, цитирует `(Иванов, 2024)` в тексте речи. Гейт: web_search **только** при отсутствии PDF — если работа есть, она приоритетнее веба.

3. **Scaffold speech** (даже если `include_speech=False`):
   - Раньше при «только презентация» слайды собирались голыми из topic+thesis. Сейчас `generate_slides_task` в начале сам генерит scaffold-речь (через тот же `_generate_speech` + web_search). Юзеру `.md` НЕ отдаётся (download-speech endpoint гейтит по `include_speech`), но slides-генерация и skeleton получают фактическую базу.
   - Гейты `_build_skeleton` и `build_speech_context_block` упрощены: проверяют только `speech_approved + speech_text`, без `include_speech`.

4. **Type-aware skeleton** (`_derive_skeleton_from_speech`):
   - Промт собирается через `pm.build_skeleton_system_prompt(order, n_slides, allow_images)`. Школа получает Что/Почему/Как; доклад — Контекст/Идея/Доказательства. Явный запрет на «слайды-заглушки типа Литература / Цели / Методология» (раньше захардкоженный «академический» промт пихал их везде).

5. **Slide content** (`_generate_with_claude` → `_build_slides_prompts`):
   - Дёргает `pm.build_slides_system_prompt`. Полный текст речи идёт как `РЕЧЬ`-блок со строгими правилами: каждый bullet — переформулировка фразы из речи, никаких новых фактов, markdown-таблицы → layout=table, числовые ряды → layout=chart.
   - `allow_enhance=True` ослабляет fact-integrity — Claude может добавить общие знания с маркером source_ref=«общее знание» (на практике использует редко).

6. **NER-валидатор** (`backend/generation/ner_validator.py`) — regex-бэкстоп над content слайдов, warn-only, `hallucinated_entities` пишутся в `orders.generation_prompt`. Env-flag `NER_VALIDATE_ENABLED`.

7. **Auto-pick palette** (`_pick_palette`): если `order.palette == 'auto'` (default Step10) → sonnet one-shot выбирает палитру под тему. Fallback на `midnight_executive`. ~$0.001 на запрос.

8. **PPTX rendering** (`pptxgen.js`): editorial-стиль с тонкими accent-линиями (1.3pt), крупная типографика (cover topic 56pt, section number 160pt, callout main 32pt bold, stats values 56-72pt, quote 36pt + кавычки 240pt). Footer `sourceFooter()` на всех content-layouts. Pie chart — цвет на сегмент (раньше все одинаковые).

9. **Slide count = выбранному юзером:** pptxgen всегда добавляет titleSlide+finalSlide (=2 авто-слайда). Расчёт `n_slides = user_count - 2`, чтобы общее в файле совпадало с UI-слайдером.

10. `/files/download-speech/{id}` отдаёт `.md` с маркерами `=== Слайд N: title ===` (только при `include_speech=True`).

**Tier-validation:** Школьный реферат + premium = 400 (backend/orders/service.py + frontend/lib/tiers.js). Premium = opus-4-7, 30 слайдов, 45 мин — overkill для школы.

**Фронтенд (редизайн 2026-04-18 + orange + pivot 2026-04-19):** dark `#0E0E0C` + orange accent `#FF5C2A` + cream ink `#FFF8EE` + Instrument Serif + маскот «научрук». Step3WorkType — две активные карточки + 4 disabled с бейджем «скоро». Step4Duration динамически зажимает MAX_SLIDES/MAX_DURATION под разрешённые для work_type тарифы (школа = max 20 слайдов / 25 мин). Step10Palette — первая опция «Авто — подберём под тему» (default `palette='auto'`). Landing переписан: hero «Презентация по теме за 1–2 минуты», testimonials школьник/маркетолог/9-классница, premium tier «Для длинного делового доклада или конференции».

**Caddy:** `index.html` теперь с `Cache-Control: no-cache, must-revalidate` (раньше браузер залипал на старом html со ссылками на устаревшие хешированные бандлы).

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
