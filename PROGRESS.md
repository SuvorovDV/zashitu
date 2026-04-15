# PROGRESS.md — статус реализации

Обновляй этот файл после каждой рабочей сессии.

---

## Следующий шаг

**1. Задеплоить backend+worker+db+redis на ту же VM через `deploy/docker-compose.prod.yml`.**

На VM:
```bash
cd ~/zashitu
cp .env.example .env.prod   # или скопировать текущий .env и дополнить ключами бэкенда
nano .env.prod              # DATABASE_URL, SECRET_KEY, BOT_INTERNAL_SECRET (= BACKEND_INTERNAL_SECRET), ANTHROPIC_API_KEY, STRIPE_*
cd deploy && docker compose -f docker-compose.prod.yml up -d --build postgres redis backend worker
docker compose -f docker-compose.prod.yml logs -f backend
```

После этого в корневом `.env` (который читает бот-контейнер) поменять `BACKEND_URL=http://backend:8000` и пересоздать bot в одной сети с бэкендом (либо объединить всё в один compose).

**2. Завести `contracts/shared.py`** — вынести туда ID тарифов (`basic/standard/premium`), ключи палитр (`midnight_executive` и т.д.), значения `work_type` (`ВКР/Курсовая/...`). Импортировать в `bot/config.py` и `backend/config.py`. Это устранит риск рассинхронизации ID между двумя Python-конфигами.

**3. E2E-тест:** `/start` → FSM → Stars → .pptx. Локально без оплаты:
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

- **Репозиторий:** https://github.com/SuvorovDV/zashitu (private, `main`)
- **VM:** Yandex Cloud, `erkobrax@111.88.151.109` (соседствует с `tg_bot_ATP`)
- **Путь на VM:** `~/zashitu` (код залит через scp; `git` на VM не настроен — обновления пока через повторный scp)
- **Бот в Telegram:** `@ai_presentations_test_bot`
- **Прокси Telegram:** `https://tg-bot-proxy.erkobraxx.workers.dev` (тот же Worker, что у ATP)
- **Запуск:** `docker compose up -d --build`, контейнер `zashitu-bot-1`, `restart: unless-stopped`
- **Бэкенд `zashitu-web`:** ❌ не задеплоен. Бот стартует, отвечает на `/start`, проходит FSM, но любой запрос, требующий API (`create_order`, `upload_file`, `confirm_payment`, генерация), упадёт с `BackendError`.

Добавленные для деплоя файлы: `Dockerfile`, `docker-compose.yml`, `railway.json`, `cloudflare-worker.js`, `wrangler.toml`, `.env.example`, `.dockerignore`, `.gitignore`, `docs/deploy-yandex.md`. В `bot/main.py` и `config.py` добавлена поддержка `TELEGRAM_API_SERVER` (переиспользуем Worker от ATP).

Инструкция и команды управления — `docs/deploy-yandex.md`.

---

## Лог изменений

| Дата | Что сделано |
|---|---|
| 2026-04-15 | **Слияние в монорепу.** `zashitu-web/{backend,frontend,deploy}` перенесены в `zashitu/`. Старый `Dockerfile` переехал в `deploy/Dockerfile.bot`, корневой `docker-compose.yml` указывает на него. `requirements.txt` → `bot/requirements.txt`. Веб-доки перенесены в `docs/web/`. `.env.example` объединён (ключи бота + бэкенда). `.gitignore`/`.dockerignore` расширены. На прод-VM пока работает только бот, бэкенд — следующим шагом. |
| 2026-04-15 | Деплой в прод. Инфра: Dockerfile + docker-compose (single service), railway.json, Cloudflare Worker proxy (reuse ATP), docs/deploy-yandex.md. В `bot/main.py` добавлен `TELEGRAM_API_SERVER` через `AiohttpSession`. Репо запушен в `github.com/SuvorovDV/zashitu`. Контейнер `zashitu-bot-1` поднят на VM ATP (`erkobrax@111.88.151.109`), polling идёт через Worker `tg-bot-proxy.erkobraxx.workers.dev`. Бэкенд `zashitu-web` ещё не задеплоен — следующий шаг. |
| 2026-04-13 | Добавлены: ВКР-обязательный source_grounded (auto-routing в FSM), генерация текста доклада (.txt) с источниками. Полный аудит: исправлены 4 бага (vkr в config, conference промт, лишний импорт). |
| 2026-04-12 | Реализован полный MVP-скелет: бот, FSM, core, генераторы, интеграции, промты. Все зависимости установлены. Бот запускается, ждёт активации токена. |
