# PROGRESS.md — статус реализации

Обновляй этот файл после каждой рабочей сессии.

---

## Следующий шаг

**1. Купить `get-tezis.ru` и перевести фронт на публичный домен.** Выбран 2026-04-18 (см. DECISIONS.md). План — в REG.RU (~590 ₽/год):
- Купить → настроить A-записи (`@` и `www` → `176.12.79.36`)
- Дождаться DNS-propagation (5 мин – 2 часа)
- На VM: обновить `deploy/.env.prod` (`ALLOWED_HOSTS`, `FRONTEND_URL`) + `git pull && docker compose -p deploy up -d --build frontend backend`
- Caddyfile уже готов (`9cdd0ad`) — Caddy сам получит TLS-серт от Let's Encrypt
- Проверить `https://get-tezis.ru` → 200, потом отдельным коммитом выпилить `tezis.176.12.79.36.nip.io`

**2. E2E-тест веб-флоу в новом dark+lime редизайне.** После коммитов `142686e..9cdd0ad` все страницы перерисованы. Пройти пользовательский сценарий: регистрация → wizard 10 шагов → payment (dev-симуляция, Stripe не подключён) → generation state-machine → скачать .pptx. Убедиться, что ничего не отвалилось из-за рестайла.

**3. Подключить Stripe.** `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET`, выключить `DEV_MODE=True` на проде. Кнопка «симулировать оплату» на `/payment` показывается через `useDevMode()` хук, завязана на `/health` → `dev_mode`. После отключения dev — проверить, что кнопка исчезает.

**4. Завести `contracts/shared.py`** — вынести туда ID тарифов (`basic/standard/premium`), ключи палитр (`midnight_executive` и т.д.), значения `work_type` (`ВКР/Курсовая/...`). Импортировать в `bot/config.py` и `backend/config.py`. Это устранит риск рассинхронизации ID между двумя Python-конфигами.

**5. Назвать компанию для футера и GitHub-орга.** Сейчас в футере `© 2026 ООО «Тезис»`, ИНН/ОГРН убраны (`b0c580b`) — фактическое юрлицо пока не зарегистрировано. Вариант B выбран (каждый проект со своим доменом, бренд компании только в подвале). Имя компании для GitHub org — открытый вопрос.

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
- Всё живёт в `~/zashitu/` (монорепа с GitHub); `git pull` работает с 2026-04-18 (раньше был scp).
- Запуск: `docker compose -p deploy -f deploy/docker-compose.prod.yml up -d` (флаг `--env-file` не нужен — в `deploy/` симлинк `.env → .env.prod`).
- 6 контейнеров под проектом `deploy`: `postgres`, `redis`, `backend`, `worker`, `frontend`, `bot`.
- Volumes `deploy_postgres_data`, `deploy_uploads`, `deploy_outputs`, `deploy_caddy_*` — данные юзеров и файлы сохраняются между релизами.
- `deploy/.env.prod` — единственный источник секретов (chmod 600), объединяет bot- и backend-ключи; симлинк `.env → .env.prod` обеспечивает интерполяцию `${VAR}` в compose-файле.
- Сеть `deploy_default` — бот ходит в бэкенд по `http://backend:8000`, фронт проксирует `/api` в бэкенд.
- Публично:
  - веб (текущий): `https://tezis.176.12.79.36.nip.io` (Caddy + nip.io + auto-TLS)
  - веб (планируется): `https://get-tezis.ru` — Caddyfile уже готов (`9cdd0ad`), ждём покупку и DNS A-записи
  - бот: `@ai_presentations_test_bot` (polling напрямую в `api.telegram.org`)
  - QR-коды: `docs/qr/qr-site.png`, `docs/qr/qr-bot.png` (пересоберутся после переезда домена)

**Репозиторий:** https://github.com/SuvorovDV/zashitu (private)

**Интегральный контракт бот↔бэкенд:**
- Бот шлёт заголовок `X-Bot-Secret`, бэкенд проверяет `settings.BOT_INTERNAL_SECRET` (код в `backend/auth/dependencies.py`, `backend/payments/router.py`). Проверено: `GET /orders/` с правильным секретом → 200, без — 401.
- `ALLOWED_HOSTS=tezis.176.12.79.36.nip.io,backend,localhost` (после переезда добавить `get-tezis.ru,www.get-tezis.ru`).

Инструкция — `docs/deploy.md`.

---

## Лог изменений

| Дата | Что сделано |
|---|---|
| 2026-04-18 | **Домен: `get-tezis.ru` выбран.** `tezis.ru` занят с 2003 года, `tezis.kz`/`.app`/`.pro`/`.studio`/`.ai`/`.io` заняты, `tezis.app` свободен на Porkbun (требует иностр. карту). Решение — `get-tezis.ru` через REG.RU (~590 ₽, росс. картой). Caddyfile обновлён в коммите `9cdd0ad` — обрабатывает `get-tezis.ru, www.get-tezis.ru, tezis.176.12.79.36.nip.io` в одном site-блоке, www → apex 301-редирект. Пользователь покупает домен и настраивает DNS A-записи; после DNS-propagation я обновляю `deploy/.env.prod` (`ALLOWED_HOSTS`, `FRONTEND_URL`) + rebuild frontend/backend. Nip.io-домен остаётся работать на время перехода, снесётся отдельным коммитом после стабилизации. |
| 2026-04-18 | **Фронтенд полностью переписан под Claude Design bundle — dark+lime student-app эстетика** (11 коммитов, `142686e..9cdd0ad`). Отказ от warm-dark editorial в пользу эстетики от Anthropic Labs Claude Design (launched 2026-04-17), которая user одобрил после просмотра bundle. Фоновая палитра `#0E0E0C` + ink `#F5F3EC` + lime accent `#C8FF3E`. Шрифты: Instrument Serif (display), Inter Tight (body), JetBrains Mono (annotations), Caveat (hand). Каждая страница пересобрана: Landing (hero + upload + specimen с hover-highlight PDF↔slide + modes toggle + process + features+testimonials + pricing + cta-strip + footer), Navbar (lime T-logo, auth-aware), Login+Register (live-валидация), Dashboard (counters+tabs+OrderCard+empty-state с маскотом), Wizard shell (inline progress + sticky summary), Payment (order summary + upgrade + pay column), Generation (state-machine с маскотом + markdown-подсветка «(с. N)» refs), NotFound (404 с маскотом). Data layer (TanStack, Zustand, API-хуки) сохранён. Bulk-swap warm-dark hex-литералов в 15 компонентах. Легаси brand-палитра ремапнута в лайм-оттенки — Step*/UI-компоненты рендерятся в новой теме без per-file правок. Плейсхолдер ИНН/ОГРН в футере убран (`b0c580b`) — заполнит владелец. |
| 2026-04-18 | **Stats-карточки и chart-слайды в pptxgen.js** (`8759218`). stats-layout переделан с 1×4 узкого ряда (48pt центр, автошринк длинных чисел, ice-blue border) на 2×2 сетку при 4 статах или 1×3 при 3 — широкие карточки, left-aligned 36/42pt value, 13pt label, левая primary-полоса вместо рамки, квадратные углы (editorial feel). chart-layout — fontFace: null (убирает hardcoded Arial → PowerPoint берёт Calibri), showValue: true, lineSize: 3, marker 8pt, один primary-цвет для 1-серии, только горизонтальные gridlines `#E5E7EB`. Сравнительные скриншоты в `.design-proposals/_stats-preview/`. |
| 2026-04-17 (вечер) | **Большая итерация качества презентаций + скачивание речи с маркерами слайдов.** (1) В `pptxgen.js` — единый межстрочный `1.3` + `paraSpaceBefore: 6` на всех bullet-списках, callout перекомпонован (текст больше не съезжает вниз). (2) Новые layout'ы `table` и `chart` в pydantic-схеме `SlideContent` + `pptxgen.js` (`addTable`/`addChart`). Claude получает в системном промте строгое правило: markdown-таблицы из речи → `layout: table`, числовые ряды по годам/категориям → `layout: chart` (воспроизводит верстально, не пересказывает). (3) **Claude-SVG pipeline** для иллюстраций: `@resvg/resvg-js` в `generation/package.json` + `svg_to_png.js` рендерит SVG в PNG. При отсутствии `OPENAI_API_KEY` иллюстрации идут через Claude с палитрой слайда. (4) Крупные `image_full`/`image_side` убраны из rotation — SVG теперь декоративный акцент в углу `default`/`callout` (~1.5×1.5"), bullets на почти всю ширину. (5) Premium тариф переведён на `claude-opus-4-7`; hotfix `_messages_kwargs()` — Opus 4.7 больше не принимает `temperature`. (6) Лимит речи в контексте слайдов 8k → 40k символов + речь оборачивается в ```markdown```, Claude видит таблицы и графики как источник. (7) **Скелет теперь выводится из речи** (`_derive_skeleton_from_speech`): если речь утверждена, первый pre-pass просит Claude спроектировать titles+layouts под реальные секции речи, а не использовать фиксированный пул. Fallback — старый пул. (8) Endpoint `GET /files/download-speech/{id}` — возвращает `.md` с маркерами `=== Слайд N: title ===`, вставленными через sonnet-4-6 (дёшево). Файловый кэш в `outputs/{order_id}_speech_{hash16}.md` — второе скачивание мгновенное. RFC 5987 `filename*=UTF-8''…` для кириллицы. (9) Frontend: лоадер «Готовим…» на обеих кнопках «Скачать текст .md» (дашборд + done-view), fetch→blob→download через axios. Кнопка «Открыть» для `awaiting_review`-заказов + лейбл статуса в `ru.dashboard.statuses`. Коммиты: `87c16ab..05bfc34`. Файлы демо: `C:\Users\erkob\Downloads\tezis_demo_v2\`. |
| 2026-04-17 (утро) | **Подключён `ANTHROPIC_API_KEY` на проде.** Ключ записан в `~/zashitu/deploy/.env.prod` (бэкап `.env.prod.bak-20260417-073205`), контейнеры `backend` и `worker` пересозданы через `docker compose up -d --no-deps`. Проверено: переменная видна внутри обоих контейнеров, длина 108, uvicorn и celery стартанули без ошибок. Генерация перестала возвращать placeholder. Попутно исправлен баг в `deploy/docker-compose.prod.yml`: `${POSTGRES_PASSWORD}` и `${DEV_TOKEN}` интерполировались из shell env (а не из `.env.prod`) и при `docker compose up -d` без `--no-deps` postgres мог пересоздаться с пустым паролем — postgres переведён на `env_file: .env.prod`, для `DEV_TOKEN` добавлен default `${DEV_TOKEN:-}`, на VM симлинк `.env → .env.prod` (belt-and-suspenders). |
| 2026-04-16 | **Миграция с Yandex Cloud на FirstVDS.** Новый сервер: `root@176.12.79.36` (FirstVDS KVM, Алматы, Ubuntu 24.04, 2 ядра / 4 ГБ / 60 ГБ NVMe). Установлен Docker 29.4.0, остановлен ispmanager nginx/apache (замаскирован). Все 6 контейнеров подняты. Caddy получил TLS для `tezis.176.12.79.36.nip.io`. Починен DNS в Docker (`daemon.json` → `8.8.8.8`). Cloudflare Worker-прокси убран — сервер в Казахстане, `api.telegram.org` доступен напрямую. Бот переименован из «Test» в «Tezis» (имя + описание через Bot API). Старый сервер Yandex Cloud выключен. |
| 2026-04-15 | **Прод переведён на монорепу.** Обнаружено, что реальный прод крутится на `111.88.153.18` (а не на `151.109`, куда я по ошибке развернул дубликат — снесён). На прод-VM стояла более старая версия бэкенда без поддержки `X-Bot-Secret` — синхронизировал 3 файла, потом полностью заменил `~/zashitu-web/` на `~/zashitu/` (монорепу). Сеть `deploy_default`, project name `deploy`, volumes преемственны (`SELECT count(*) FROM users → 3` сохранилось). В `deploy/.env.prod` добавлены `BOT_INTERNAL_SECRET`, `BOT_SERVICE_USER_EMAIL`, в `ALLOWED_HOSTS` — `backend,localhost`. Бот `deploy-bot-1` теперь в одной сети с бэкендом. Сгенерированы QR-коды для сайта и бота в `docs/qr/`. |
| 2026-04-15 | **Слияние в монорепу.** `zashitu-web/{backend,frontend,deploy}` перенесены в `zashitu/`. Старый `Dockerfile` переехал в `deploy/Dockerfile.bot`, корневой `docker-compose.yml` указывает на него. `requirements.txt` → `bot/requirements.txt`. Веб-доки перенесены в `docs/web/`. `.env.example` объединён (ключи бота + бэкенда). `.gitignore`/`.dockerignore` расширены. На прод-VM пока работает только бот, бэкенд — следующим шагом. |
| 2026-04-15 | Деплой в прод. Инфра: Dockerfile + docker-compose (single service), railway.json, Cloudflare Worker proxy (reuse ATP), docs/deploy-yandex.md. В `bot/main.py` добавлен `TELEGRAM_API_SERVER` через `AiohttpSession`. Репо запушен в `github.com/SuvorovDV/zashitu`. Контейнер `zashitu-bot-1` поднят на VM ATP (`erkobrax@111.88.151.109`), polling идёт через Worker `tg-bot-proxy.erkobraxx.workers.dev`. Бэкенд `zashitu-web` ещё не задеплоен — следующий шаг. |
| 2026-04-13 | Добавлены: ВКР-обязательный source_grounded (auto-routing в FSM), генерация текста доклада (.txt) с источниками. Полный аудит: исправлены 4 бага (vkr в config, conference промт, лишний импорт). |
| 2026-04-12 | Реализован полный MVP-скелет: бот, FSM, core, генераторы, интеграции, промты. Все зависимости установлены. Бот запускается, ждёт активации токена. |
