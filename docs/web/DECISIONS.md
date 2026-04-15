# DECISIONS.md — принятые решения

> Перед тем как менять что-то архитектурное — прочитай этот файл.
> Здесь объяснено ПОЧЕМУ так, а не иначе.

---

## Бэкенд на FastAPI, а не Node.js

Существующий код генерации написан на Python (`pptx_builder.py`, `prompt_builder.py` и т.д.).
FastAPI позволяет Celery-воркеру импортировать их напрямую без межпроцессного взаимодействия.
Node.js потребовал бы вызова Python через child_process — лишняя сложность.

---

## Celery + Redis для генерации, а не FastAPI background tasks

Генерация через Claude API занимает 30–120 секунд. Background tasks в FastAPI теряются при
перезапуске сервера. Celery даёт персистентность задач, retry логику и независимое масштабирование.

В локальной разработке: `CELERY_TASK_ALWAYS_EAGER=True` — задачи выполняются синхронно,
воркер не нужен. В проде: отдельный процесс `celery -A celery_app worker`.

---

## Синхронный psycopg2 в Celery, а не asyncpg

asyncpg требует event loop. В Celery-воркере нет async event loop по умолчанию — ненадёжно.
Синхронный psycopg2 в Celery — стандартное решение.

В `generation/tasks.py` DATABASE_URL: `+asyncpg` → `+psycopg2`. Для SQLite: `+aiosqlite` → убирается
(нативный SQLite драйвер синхронный по умолчанию).

---

## JWT в httpOnly cookies, а не localStorage

httpOnly cookies недоступны из JavaScript — защита от XSS-атак.
localStorage токены можно украсть через XSS.
axios отправляет cookies автоматически через `withCredentials: true`.

Два токена:
- `access_token`: 15 минут, для каждого запроса
- `refresh_token`: 7 дней, только для `/auth/refresh`

---

## Stripe Checkout (hosted page), а не Stripe Elements

Hosted page — Stripe берёт на себя PCI compliance. Мы не храним и не видим данные карт.
Elements потребовал бы прохождения PCI DSS аудита.

**Важно:** статус заказа меняется ТОЛЬКО по webhook с верифицированной подписью Stripe.
Параметры `success_url` игнорируются — их можно подделать вручную.

---

## Цены только в backend/config.py (TIERS)

Если цена в фронте — её можно подменить через DevTools перед отправкой запроса.
Бэк всегда берёт цену из `TIERS` по имени тарифа (`basic`, `standard`, `premium`).
Фронт только отображает цены, полученные через `GET /payments/tiers`.

---

## pptxgen.js — Node.js для .pptx, вызывается через subprocess

Python-библиотека python-pptx ограничена по возможностям верстки.
pptxgenjs (Node.js) даёт гибкий контроль над макетом и дизайном слайдов.
Celery-воркер вызывает Node.js через `subprocess.run`, передавая JSON-план через stdin.

**Кириллица и charset:**

pptxgenjs добавляет `charset="0"` (Latin/ANSI) в XML-теги шрифтов внутри PPTX.
Применены два механизма защиты:

1. Функция `t()` в pptxgen.js удаляет `fontFace` из всех text-опций → pptxgenjs не пишет
   явные `<a:latin typeface="..." charset="0"/>` в слайды, использует тему (Calibri без charset).

2. `_fix_cyrillic_charset()` в tasks.py патчит PPTX после генерации: обходит **все `.xml` файлы**
   внутри zip-архива и меняет `charset="0"` → `charset="204"` (Russian LOGFONT).
   Критично патчить ВСЕ XML (слайды, мастера, лейауты, тему) — иначе часть остаётся сломанной.

**FONT_TITLE / FONT_BODY** объявлены как `null` — нужны только чтобы избежать `ReferenceError`
при вычислении объектных литералов. `t()` их удаляет перед передачей в pptxgenjs.

---

## Палитра: дефолт `midnight_executive`, не пустая строка

`wizardDefaults.palette` был `''`. `getFormData()` возвращал `undefined` для пустой строки.
Бэкенд писал `NULL`, генератор фоллбэчил на `"blue"` независимо от выбора пользователя.

Фиксировано в трёх местах:
- `wizardDefaults.palette = 'midnight_executive'`
- `getFormData()`: `palette: s.palette || 'midnight_executive'`
- `_assemble_plan`: `order.palette or 'midnight_executive'`

---

## Дизайн-система: solid surfaces, а не glassmorphism

Glassmorphism (`rgba(255,255,255,0.04)`) выглядит красиво на ярких фонах.
На тёмном фоне `#0D0D1A` карточки почти невидимы, контраст текста недостаточен.

Решение: solid `#131328` с границей `#242448` — карточки чётко читаются.
Glassmorphism сохранён только для `.card-glass` — оверлеи поверх частиц в hero.

Контраст текста:
- Было: `text-gray-400` (`#9CA3AF`) на `#0B0F1E` — контраст ~4.1:1 (граница WCAG AA)
- Стало: `#ADADCC` на `#131328` — контраст ~7.5:1 (WCAG AAA)

---

## ParticleBackground: canvas, а не CSS-анимации

CSS-анимации не дают произвольных траекторий и связей между элементами.
Canvas даёт полный контроль: произвольное движение, линии между соседними частицами, glow.

Особенности реализации:
- `prefers-reduced-motion: reduce` → анимация отключается, рисуется статичная картинка
- `ResizeObserver` вместо `resize` event → корректно реагирует на изменение размера контейнера
- `aria-hidden="true"` → скрыт от screen readers
- Только `transform`/`opacity` не используются — canvas API вне DOM, нет layout thrashing

---

## Navbar: `<Link>` вместо `<button onClick navigate>`

`<button onClick={() => navigate('/wizard')}>` — нарушение Web Guidelines:
- Не работает Cmd+Click (открыть в новой вкладке)
- Не работает правая кнопка → "Открыть в новой вкладке"
- Семантически неверно: навигация должна быть `<a>`, действие — `<button>`

Все навигационные элементы в Navbar заменены на `<Link to="...">`.

---

## Тесты: SQLite in-memory + StaticPool, а не Docker PostgreSQL

Тесты должны работать без инфраструктуры (PostgreSQL, Redis).
SQLite in-memory с `StaticPool` — все соединения в одном экземпляре БД,
каждый тест получает чистую базу через отдельный `engine`.

`app.dependency_overrides[get_db]` — подменяет зависимость FastAPI без изменения кода приложения.
`lifespan` не триггерится в тестах (httpx ASGITransport по умолчанию).

---

## Mock-генератор как fallback

Разработчик веб-части может не иметь оригинального кода бота.
Mock создаёт валидный .pptx с заглушками — весь флоу работает без Claude API.
Переключение: `GENERATION_MODE=mock|real` в `.env`.

Без `ANTHROPIC_API_KEY`: используется `_generate_placeholder()` — русские заглушки.
Вопросики в презентации — это проблема charset, не отсутствия API ключа.

---

## Файлы по UUID, а не по оригинальным именам

UUID-имена предотвращают:
- **IDOR**: нельзя угадать чужой файл по порядковому номеру
- **Коллизии**: два файла `diplom.pdf` не конфликтуют
- **Path traversal**: `../../../etc/passwd` не работает как имя

Оригинальное имя сохраняется в БД в `original_filename` для отображения пользователю.

---

## Один файл на заказ

`UploadedFile` имеет UNIQUE constraint на `order_id`.
При повторной загрузке старый файл удаляется с диска и из БД.
Упрощает логику генерации — всегда один файл по `order_id`.

---

## Zustand persist для визарда

Студент может закрыть вкладку на шаге 5 и вернуться позже.
Zustand persist сохраняет черновик в localStorage автоматически.
Ключ: `zashitu_wizard_draft`. Очищается через `wizardStore.reset()` после успешного создания.

---

## Polling, а не WebSocket

Генерация идёт 1–2 минуты. WebSocket — избыточное усложнение для такого кейса.
TanStack Query `refetchInterval` делает polling каждые 3 секунды.
Когда статус `done` или `failed` — `refetchInterval` возвращает `false`, polling останавливается.

---

## Что НЕ делаем и почему

**Google OAuth** — требует Google Cloud проекта, верификации домена. Лишняя сложность для MVP.

**Email-подтверждение** — требует SMTP/SendGrid. `is_verified=True` сразу при регистрации.
Поле оставлено в модели для будущего подключения.

**S3/R2** — локальное хранение достаточно для MVP. Замена: только `files/service.py`.

**Rate limiting** — добавить через `slowapi` после MVP.

**Превью слайдов в браузере** — нет простого браузерного решения для рендеринга .pptx.

**Промокоды, Telegram-связка** — после MVP.

---

## Сессия #2 (2026-04-14)

### Палитра Янтарь (`#F59E0B`) вместо фиолета

Фиолетовый (`#7C3AED`) давал «generic AI-лендинг» ощущение. Янтарь + warm-dark (`#0F0E0B`, `#1A1712`) — тёплее, премиальнее, отличимо от конкурентов.
Реализация: `tailwind.config.js` + bulk-замена хексов во всех `.jsx`/`.js` (sed).

### In-memory rate limiter вместо slowapi

`auth/rate_limit.py` — собственный в 40 строк. Причина: проект пока single-instance, `slowapi` добавляет зависимость + требует Redis для кластера. Для prod-кластера нужно заменить.

### Структурированное логирование stdlib, без structlog/loguru

`logging_config.py` — JSON formatter в prod, human в dev. Минимальная зависимость, достаточно для `uvicorn` + сервисных логов. При росте сложности — заменить на `structlog`.

### Magic bytes вручную, не python-magic

`files/validators.py` — проверка первых байт (`%PDF-`, `PK\x03\x04`). `python-magic` на Windows требует libmagic.dll, в репо его нет. Для 2 форматов проверить сигнатуру — 5 строк.

### `persist.partialize` в zustand-store

`orderId`/`currentStep` НЕ персистятся — иначе после смены формы пользователь возвращается к старому заказу, копятся orphan. Только form-поля живут в localStorage.

### TopProgressBar через `useIsFetching` + `useLocation`

Вместо NProgress. Привязка к React Query состоянию дёшевле и без новой зависимости. Градиент + glow + блик — визуальная компенсация простоты.

### Репозиторный слой — отложен

Вместо router/service/repository сейчас router/service-with-sql. Причина: чистое разделение требует 1–2 сессий работы, MVP без него живёт. Запланировано в Phase 2 следующей сессии (см. `ROADMAP.md`).

### Alembic — отложен

Пока используется `create_all` + `_add_missing_columns` в `database.py`. Для prod/Postgres Alembic обязателен; для SQLite dev достаточно текущего подхода. Переход на Alembic — Phase 2 следующей сессии.

### SQLite БД удаляется при добавлении индексов

Вместо написания ручной миграции под индексы (добавлены в сессии #2) — проще удалить `backend/zashitu.db` и пересоздать. Dev-данные не критичны. В prod — Alembic.

