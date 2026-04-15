# CLAUDE.md — контекст проекта для Claude в терминале

> Этот файл читай ПЕРВЫМ в каждой новой сессии. Он даёт полный контекст без необходимости объяснять заново.

---

## Что это за проект

**ZaShitu** — Telegram-бот для генерации академических презентаций (.pptx).

Студент пишет боту → бот собирает данные через FSM-диалог → загружает файл (если есть) → оплачивает через Stars → бэкенд `zashitu-web` генерирует .pptx через Claude API → бот отдаёт файл.

**Не делаем:** написание дипломных/курсовых работ, TG Mini App, нативные приложения.

**Главное отличие от Gamma:** Gamma генерирует слайды «из головы» — мы генерируем **по загруженной работе студента** с ссылками на страницы. Нет галлюцинаций, каждый тезис верифицируем. Подробнее в `DECISIONS.md → Конкурентная позиция`.

---

## Архитектура: бот = тонкий клиент `zashitu-web`

Этот репозиторий содержит **только бот**. Вся бизнес-логика (Claude API, извлечение PDF/DOCX, сборка .pptx, база данных заказов) живёт в отдельном проекте **`zashitu-web`** (FastAPI).

Бот ходит в бэкенд через `bot/api_client.py`, заголовок `X-Bot-Secret` (из `BACKEND_INTERNAL_SECRET`):

- `POST /orders/` — создать заказ
- `POST /files/upload/{order_id}` — загрузить PDF/DOCX
- `POST /payments/internal/confirm` — подтвердить оплату (после Stars)
- `GET /generation/status/{order_id}` — поллинг готовности
- `GET /files/download/{order_id}` — забрать .pptx

**Важно:** документация об `core/`, `integrations/`, `generators/`, `prompts/` в старых версиях архитектуры относится к `zashitu-web`, не к этому репозиторию.

---

## Текущий статус

Смотри `PROGRESS.md` — там актуальный статус каждого модуля и деплоя.

---

## Стек (бот)

- **Bot:** aiogram 3.27 (async, polling)
- **HTTP client:** httpx (вызовы `zashitu-web`)
- **FSM storage:** MemoryStorage (теряется при рестарте контейнера)
- **Config:** python-dotenv
- **Deploy:** Docker + docker-compose, Yandex Cloud VM, Cloudflare Worker как прокси к `api.telegram.org`

---

## Структура проекта (бот)

```
zashitu/
├── CLAUDE.md              ← этот файл
├── PROGRESS.md            ← статус реализации + баги + деплой
├── DECISIONS.md           ← принятые решения
├── architecture_v5.md     ← детальная архитектура
├── roadmap_v3.md          ← roadmap
├── bot/
│   ├── main.py            ← polling, опц. TELEGRAM_API_SERVER
│   ├── api_client.py      ← тонкий клиент zashitu-web
│   ├── handlers/
│   │   ├── start.py
│   │   ├── form.py        ← FSM 10 шагов + загрузка файла
│   │   └── payment.py     ← Stars + DEBUG_SKIP_PAYMENT
│   ├── keyboards/inline.py
│   └── states.py          ← 14 состояний FSM
├── storage/user_sessions.py  ← in-memory {chat_id: FormData}
├── config.py              ← env-переменные, TIERS, WORK_TYPES, PALETTES
├── requirements.txt
├── Dockerfile             ← python:3.12-slim, python bot/main.py
├── docker-compose.yml     ← один сервис bot, restart: unless-stopped
├── railway.json           ← альтернативный деплой на Railway
├── cloudflare-worker.js   ← прокси к api.telegram.org (РФ-хостинг)
├── wrangler.toml
├── .env.example
├── .dockerignore / .gitignore
└── docs/
    └── deploy-yandex.md
```

---

## Ключевые решения (подробнее в DECISIONS.md)

- **Бот ≠ монолит.** Вся генерация на стороне `zashitu-web`. Это репо — только UX в Telegram.
- **Режим `source_grounded`** — главный режим MVP. Claude работает только с текстом загруженной работы. Каждый слайд → поле `source: "стр. X"`.
- **Три тарифа:** базовый 99⭐, стандарт 199⭐, премиум 399⭐. Значения цен и лимитов — в `config.py → TIERS`, синхронизированы с `zashitu-web/backend/config.py`.
- **FSM форма:** 10 шагов пользователя (тема, направление, тип работы, длительность, детализация, тезис, вуз, обязательные элементы, режим, палитра).
- **Оплата:** `send_invoice` → `pre_checkout_query` → `successful_payment` → `api_client.confirm_payment()`.
- **Хранение сессии:** dict `{chat_id: FormData}`, очищать после отдачи файла.

---

## Деплой (прод)

- **Репозиторий:** https://github.com/SuvorovDV/zashitu (private)
- **VM:** Yandex Cloud, `erkobrax@111.88.151.109`, соседствует с `tg_bot_ATP`
- **Путь на VM:** `~/zashitu` (залито через scp, git на VM не настроен)
- **Бот:** `@ai_presentations_test_bot` (тестовый токен)
- **Прокси Telegram:** `https://tg-bot-proxy.erkobraxx.workers.dev` (общий с ATP)
- **Запуск:** `docker compose up -d --build`, `restart: unless-stopped`
- **Бэкенд `zashitu-web`:** пока не задеплоен — бот стартует и проходит FSM, но падает на первом `POST /orders/`

Подробности и управление — `docs/deploy-yandex.md`.

---

## Переменные окружения (`.env`)

| Переменная | Назначение |
|---|---|
| `BOT_TOKEN` | Токен от @BotFather |
| `BACKEND_URL` | URL `zashitu-web`, по умолчанию `http://localhost:8000` |
| `BACKEND_INTERNAL_SECRET` | Секрет заголовка `X-Bot-Secret` |
| `TELEGRAM_API_SERVER` | (опц.) URL Cloudflare Worker для прокси к Telegram |
| `DEBUG_SKIP_PAYMENT` | `true` — пропустить Stars, сразу подтвердить оплату |

---

## Что сейчас нужно реализовать

Смотри `PROGRESS.md` раздел "Следующий шаг".

---

## Как работать в этом проекте

1. Читай `CLAUDE.md` (этот файл)
2. Читай `PROGRESS.md` — что уже есть, что нет
3. Читай `DECISIONS.md` — почему так, а не иначе
4. Реализуй конкретный модуль
5. После реализации обнови `PROGRESS.md`

Не изобретай новые решения без крайней необходимости — сначала смотри `DECISIONS.md`.
