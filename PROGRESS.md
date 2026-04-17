# PROGRESS.md — статус реализации

Обновляй этот файл после каждой рабочей сессии.

---

## Следующий шаг

**1. E2E-тест всего прод-флоу с реальным Claude.** Ключ `ANTHROPIC_API_KEY` подключён 2026-04-17. Прогнать оба канала и убедиться, что `source_grounded` возвращает тезисы со ссылками на страницы (не заглушку):
- Telegram: `/start` → 10 шагов FSM → выбор тарифа → Stars → получить реальный .pptx
- Веб: регистрация → форма → «Симулировать оплату» (`/dev/*`) → получить реальный .pptx

**2. Подключить Stripe.** `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET`, выключить `DEV_MODE=True` на проде. Проверить, что кнопка «симулировать оплату» перестаёт показываться.

**3. Завести `contracts/shared.py`** — вынести туда ID тарифов (`basic/standard/premium`), ключи палитр (`midnight_executive` и т.д.), значения `work_type` (`ВКР/Курсовая/...`). Импортировать в `bot/config.py` и `backend/config.py`. Это устранит риск рассинхронизации ID между двумя Python-конфигами.

**4. Настроить git на VM.** Сейчас обновления идут через scp; поставить `gh` или deploy-key, чтобы было `git pull && docker compose ... up -d --build`.

Локально без оплаты (бот):
```bash
# в .env:
DEBUG_SKIP_PAYMENT=true
```

---

## Критические баги (исправить до e2e теста)

### ✅ Баг 1: `vkr` добавлен в `config.py` WORK_TYPES (исправлен 2026-04-13)
- `"vkr": "ВКР / Дипломная работа"` добавлен в config.py

### ✅ Баг 2: `conference_v1.md` создан (исправлен 2026-04-13)
- `prompts/work_type/conference_v1.md` создан

### 🟡 Баг 3: Выбор палитры не влияет на .pptx
- Шаг 9 из 10 — пользователь выбирает палитру из 8 вариантов
- `prompt_builder.py` передаёт цвета палитры в текст промта Claude (OK)
- `pptx_builder.py` использует **захардкоженные** цвета `COLOR_BG_DARK`, `COLOR_ACCENT` и т.д.
- Итог: все презентации выходят в одной тёмно-синей теме, независимо от выбора
- **Фикс:** передавать `palette` в `build_pptx()` и применять цвета из `PALETTES[palette]`

### ✅ Баг 4: лишний импорт `generation` убран из `main.py` (исправлен 2026-04-13)

---

## Статус модулей

| Модуль | Статус | Заметки |
|---|---|---|
| `bot/main.py` | ✅ готов | polling, регистрация роутеров |
| `bot/handlers/start.py` | ✅ готов | /start, оферта, главное меню |
| `bot/handlers/form.py` | ✅ готов | FSM **10 шагов** + загрузка файла |
| `bot/handlers/payment.py` | ✅ готов | send_invoice + Stars + DEBUG_SKIP_PAYMENT |
| `bot/handlers/generation.py` | ✅ готов | запуск генерации, отправка .pptx, предложение доклада, callback-обработчики |
| `bot/keyboards/inline.py` | ✅ готов | кнопки режимов, тарифов, навигация, палитра |
| `bot/states.py` | ✅ готов | FormStates (14 состояний) |
| `core/claude_client.py` | ✅ готов | AsyncAnthropic, парсинг JSON |
| `core/prompt_builder.py` | ✅ готов | модульная сборка промта, передаёт палитру в текст |
| `core/schema_validator.py` | ✅ готов | валидация + нормализация слайдов |
| `integrations/pdf_extractor.py` | ✅ готов | PyMuPDF, нумерация страниц |
| `integrations/docx_extractor.py` | ✅ готов | python-docx, псевдостраницы |
| `integrations/source_indexer.py` | ✅ готов | обрезка до 60K токенов |
| `generators/pptx_builder.py` | ⚠️ баг | 6 layout-ов + generic fallback, палитра не применяется (баг 3) |
| `generators/template_filler.py` | не начат | нужен для design_template (этап 2) |
| `storage/user_sessions.py` | ✅ готов | dict in-memory, FormData |
| `config.py` | ✅ готов | тарифы, модели, лимиты, 5 типов работ |
| `prompts/core_v1.md` | ✅ готов | |
| `prompts/tiers/basic_v1.md` | ✅ готов | |
| `prompts/tiers/standard_v1.md` | ✅ готов | |
| `prompts/tiers/premium_v1.md` | ✅ готов | |
| `prompts/input_mode/no_template_v1.md` | ✅ готов | |
| `prompts/input_mode/source_grounded_v1.md` | ✅ готов | |
| `prompts/input_mode/structure_template_v1.md` | ❌ нет файла | режим доступен в меню (premium), но промта нет |
| `prompts/input_mode/design_template_v1.md` | ❌ нет файла | режим доступен в меню (premium), но промта нет |
| `prompts/speech_v1.md` | ✅ готов | промт для генерации текста доклада |
| `prompts/work_type/vkr_v1.md` | ✅ готов | |
| `prompts/work_type/coursework_v1.md` | ✅ готов | |
| `prompts/work_type/school_v1.md` | ✅ готов | |
| `prompts/work_type/seminar_v1.md` | ✅ готов | |
| `prompts/work_type/conference_v1.md` | ✅ готов | создан 2026-04-13 |
| `prompts/schemas/slide_schema_v1.json` | ✅ готов | |
| `requirements.txt` | ✅ готов | aiogram 3.27, anthropic 0.94 |

---

## FSM — реальные состояния (10 шагов пользователя)

| # | State | Описание |
|---|---|---|
| 1 | `topic` | Тема |
| 2 | `direction` | Направление / предмет |
| 3 | `work_type` | Тип работы (кнопки) |
| 4 | `duration` | Длительность (мин) или → sub-step |
| 4b | `slides_input` | Ручной ввод кол-ва слайдов |
| 5 | `detail_level` | Уровень детализации (кнопки) |
| 6 | `key_thesis` | Ключевой тезис |
| 7 | `institution` | Учебное заведение |
| 8 | `optional_q` | Обязательные элементы (можно пропустить) |
| 9 | `input_mode` | Режим создания (кнопки) |
| 10 | `palette` | Цветовая палитра (кнопки) |
| — | `file_upload` | Загрузка PDF/DOCX (если source_grounded) |
| — | `payment` | Выбор тарифа + подтверждение |
| — | `generating` | Идёт генерация |

---

## Порядок реализации (MVP)

- [x] 1. `config.py` + `requirements.txt` + `.env.example`
- [x] 2. `bot/states.py` — FormStates
- [x] 3. `bot/keyboards/inline.py` — базовые кнопки
- [x] 4. `bot/handlers/start.py` — /start, главное меню
- [x] 5. `bot/handlers/form.py` — FSM + загрузка файла
- [x] 6. `bot/main.py` — запуск polling
- [x] 7. `core/claude_client.py`
- [x] 8. `prompts/schemas/slide_schema_v1.json`
- [x] 9. `prompts/core_v1.md` + tier/work_type промты
- [x] 10. `prompts/input_mode/no_template_v1.md` + `source_grounded_v1.md`
- [x] 11. `core/prompt_builder.py`
- [x] 12. `core/schema_validator.py`
- [x] 13. `generators/pptx_builder.py`
- [x] 14. `storage/user_sessions.py`
- [x] 15. `bot/handlers/generation.py` + `payment.py` — связать всё вместе
- [x] 16. Исправить баги 1–4 (vkr в config, conference промт, лишний импорт)
- [ ] 17. **End-to-end тест: no_template без оплаты (дебаг-режим)** ← СЕЙЧАС
- [ ] 18. Оплата Stars — протестировать реальную транзакцию
- [ ] 19. End-to-end тест: source_grounded с реальным PDF
- [ ] 20. Бета-тест (5–10 студентов)
- [ ] 21. Публичный запуск

---

## Известные проблемы

- Telegram Bot Token не оплачен — бот запускается, но не принимает сообщения. Решение: оплатить/активировать через @BotFather.
- `bot/main.py` требует запуска из корня проекта (исправлено через `sys.path` в файле).
- `structure_template` и `design_template` показываются в меню режимов (для всех пользователей), но работают только на премиуме и промт-файлы ещё не написаны.
- `pptx_builder.py` реализует только 6 layout-ов из 13 описанных в архитектуре. Остальные падают в generic fallback — работает, но без уникального дизайна.

---

## Структура монорепы

После объединения (2026-04-15) в репо лежит и бот, и бэкенд, и фронт:

- `bot/` — Telegram-бот (этот проект, как был)
- `backend/` — FastAPI + Celery из бывшего `zashitu-web/backend/`
- `frontend/` — React SPA из бывшего `zashitu-web/frontend/`
- `deploy/` — `Dockerfile.{bot,backend,frontend}` + `docker-compose.prod.yml` + `Caddyfile`
- `docs/web/` — старые `CLAUDE.md`/`PROGRESS.md`/`DECISIONS.md`/`ROADMAP.md`/`REVIEW.md` веб-проекта (сохранены для контекста)

История `zashitu-web` не сохранилась — у проекта не было `.git`, влили как единый снапшот.

---

## Деплой

**Прод (FirstVDS KVM, Алматы, `root@176.12.79.36`):**
- Всё живёт в `~/zashitu/` (монорепа с GitHub)
- Запуск: `docker compose -p deploy -f deploy/docker-compose.prod.yml up -d` (флаг `--env-file` не нужен — в `deploy/` симлинк `.env → .env.prod`)
- 6 контейнеров под проектом `deploy`: `postgres`, `redis`, `backend`, `worker`, `frontend`, `bot`
- Volumes `deploy_postgres_data`, `deploy_uploads`, `deploy_outputs`, `deploy_caddy_*` — данные юзеров и файлы сохраняются между релизами
- `deploy/.env.prod` — единственный источник секретов (chmod 600), объединяет bot- и backend-ключи; симлинк `.env → .env.prod` обеспечивает интерполяцию `${VAR}` в compose-файле
- Сеть `deploy_default` — бот ходит в бэкенд по `http://backend:8000`, фронт проксирует `/api` в бэкенд
- Публично:
  - веб — `https://tezis.176.12.79.36.nip.io` (Caddy + nip.io + auto-TLS)
  - бот — `@ai_presentations_test_bot` (polling напрямую в `api.telegram.org`)
  - QR-коды: `docs/qr/qr-site.png` → `https://tezis.176.12.79.36.nip.io`, `docs/qr/qr-bot.png` → `https://t.me/ai_presentations_test_bot` (пересобраны 2026-04-17)

**Репозиторий:** https://github.com/SuvorovDV/zashitu (private)

**Интегральный контракт бот↔бэкенд:**
- Бот шлёт заголовок `X-Bot-Secret`, бэкенд проверяет `settings.BOT_INTERNAL_SECRET` (код в `backend/auth/dependencies.py`, `backend/payments/router.py`). Проверено: `GET /orders/` с правильным секретом → 200, без — 401.
- `ALLOWED_HOSTS=tezis.176.12.79.36.nip.io,backend,localhost` (раньше был только публичный домен — бот падал с `400 Invalid host header`).

Инструкция — `docs/deploy.md`.

---

## Лог изменений

| Дата | Что сделано |
|---|---|
| 2026-04-17 | **Подключён `ANTHROPIC_API_KEY` на проде.** Ключ записан в `~/zashitu/deploy/.env.prod` (бэкап `.env.prod.bak-20260417-073205`), контейнеры `backend` и `worker` пересозданы через `docker compose up -d --no-deps`. Проверено: переменная видна внутри обоих контейнеров, длина 108, uvicorn и celery стартанули без ошибок. Генерация перестала возвращать placeholder. Попутно исправлен баг в `deploy/docker-compose.prod.yml`: `${POSTGRES_PASSWORD}` и `${DEV_TOKEN}` интерполировались из shell env (а не из `.env.prod`) и при `docker compose up -d` без `--no-deps` postgres мог пересоздаться с пустым паролем — postgres переведён на `env_file: .env.prod`, для `DEV_TOKEN` добавлен default `${DEV_TOKEN:-}`, на VM симлинк `.env → .env.prod` (belt-and-suspenders). |
| 2026-04-16 | **Миграция с Yandex Cloud на FirstVDS.** Новый сервер: `root@176.12.79.36` (FirstVDS KVM, Алматы, Ubuntu 24.04, 2 ядра / 4 ГБ / 60 ГБ NVMe). Установлен Docker 29.4.0, остановлен ispmanager nginx/apache (замаскирован). Все 6 контейнеров подняты. Caddy получил TLS для `tezis.176.12.79.36.nip.io`. Починен DNS в Docker (`daemon.json` → `8.8.8.8`). Cloudflare Worker-прокси убран — сервер в Казахстане, `api.telegram.org` доступен напрямую. Бот переименован из «Test» в «Tezis» (имя + описание через Bot API). Старый сервер Yandex Cloud выключен. |
| 2026-04-15 | **Прод переведён на монорепу.** Обнаружено, что реальный прод крутится на `111.88.153.18` (а не на `151.109`, куда я по ошибке развернул дубликат — снесён). На прод-VM стояла более старая версия бэкенда без поддержки `X-Bot-Secret` — синхронизировал 3 файла, потом полностью заменил `~/zashitu-web/` на `~/zashitu/` (монорепу). Сеть `deploy_default`, project name `deploy`, volumes преемственны (`SELECT count(*) FROM users → 3` сохранилось). В `deploy/.env.prod` добавлены `BOT_INTERNAL_SECRET`, `BOT_SERVICE_USER_EMAIL`, в `ALLOWED_HOSTS` — `backend,localhost`. Бот `deploy-bot-1` теперь в одной сети с бэкендом. Сгенерированы QR-коды для сайта и бота в `docs/qr/`. |
| 2026-04-15 | **Слияние в монорепу.** `zashitu-web/{backend,frontend,deploy}` перенесены в `zashitu/`. Старый `Dockerfile` переехал в `deploy/Dockerfile.bot`, корневой `docker-compose.yml` указывает на него. `requirements.txt` → `bot/requirements.txt`. Веб-доки перенесены в `docs/web/`. `.env.example` объединён (ключи бота + бэкенда). `.gitignore`/`.dockerignore` расширены. На прод-VM пока работает только бот, бэкенд — следующим шагом. |
| 2026-04-15 | Деплой в прод. Инфра: Dockerfile + docker-compose (single service), railway.json, Cloudflare Worker proxy (reuse ATP), docs/deploy-yandex.md. В `bot/main.py` добавлен `TELEGRAM_API_SERVER` через `AiohttpSession`. Репо запушен в `github.com/SuvorovDV/zashitu`. Контейнер `zashitu-bot-1` поднят на VM ATP (`erkobrax@111.88.151.109`), polling идёт через Worker `tg-bot-proxy.erkobraxx.workers.dev`. Бэкенд `zashitu-web` ещё не задеплоен — следующий шаг. |
| 2026-04-13 | Добавлены: ВКР-обязательный source_grounded (auto-routing в FSM), генерация текста доклада (.txt) с источниками. Полный аудит: исправлены 4 бага (vkr в config, conference промт, лишний импорт). |
| 2026-04-12 | Реализован полный MVP-скелет: бот, FSM, core, генераторы, интеграции, промты. Все зависимости установлены. Бот запускается, ждёт активации токена. |
