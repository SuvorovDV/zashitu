# CLAUDE.md — контекст проекта для Claude в терминале

> Этот файл читай ПЕРВЫМ в каждой новой сессии. Он даёт полный контекст без необходимости объяснять заново.

---

## Что это за проект

**ZaShitu** — Telegram-бот для генерации академических презентаций (.pptx).

Студент пишет боту → бот собирает данные через FSM-диалог → загружает файл (если есть) → оплачивает через Stars → бот генерирует .pptx через Claude API → отдаёт файл.

**Не делаем:** написание дипломных/курсовых работ, TG Mini App, нативные приложения.

**Главное отличие от Gamma:** Gamma генерирует слайды «из головы» — мы генерируем **по загруженной работе студента** с ссылками на страницы. Нет галлюцинаций, каждый тезис верифицируем. Подробнее в `DECISIONS.md → Конкурентная позиция`.

---

## Текущий статус

Смотри `PROGRESS.md` — там актуальный статус каждого модуля.

---

## Стек

- **Бот:** aiogram 3.x (async)
- **AI:** Anthropic Python SDK (`claude-sonnet-4-6`, `claude-opus-4-6`)
- **PDF:** PyMuPDF (fitz)
- **DOCX:** python-docx
- **PPTX:** python-pptx
- **Хранение сессий:** dict in-memory (MVP)
- **Конфиг:** python-dotenv

---

## Структура проекта

```
zashitu/
├── CLAUDE.md              ← этот файл, читай первым
├── PROGRESS.md            ← статус реализации + баги
├── DECISIONS.md           ← принятые решения и их причины
├── architecture_v5.md     ← детальная архитектура (v5: бот вместо Mini App)
├── roadmap_v3.md          ← продуктовый roadmap по этапам
├── bot/
│   ├── main.py
│   ├── handlers/
│   │   ├── start.py
│   │   ├── form.py        ← FSM 10 шагов
│   │   ├── payment.py
│   │   └── generation.py
│   ├── keyboards/inline.py
│   └── states.py          ← 14 состояний FSM
├── core/
│   ├── claude_client.py
│   ├── prompt_builder.py
│   └── schema_validator.py
├── integrations/
│   ├── pdf_extractor.py
│   ├── docx_extractor.py
│   └── source_indexer.py
├── generators/
│   ├── pptx_builder.py
│   └── template_filler.py  ← не начат (этап 2)
├── prompts/
│   ├── core_v1.md
│   ├── tiers/              ← basic, standard, premium
│   ├── input_mode/         ← no_template, source_grounded (остальные не готовы)
│   ├── work_type/          ← vkr, coursework, school, seminar
│   └── schemas/slide_schema_v1.json
├── storage/user_sessions.py
├── config.py
├── requirements.txt
└── .env
```

---

## Ключевые решения (подробнее в DECISIONS.md)

- **Режим `source_grounded`** — главный режим MVP. Claude работает только с текстом загруженной работы. Каждый слайд → поле `source: "стр. X"`.
- **Три тарифа:** базовый 99⭐ (Sonnet, 12 слайдов), стандарт 199⭐ (Sonnet, 20 слайдов), премиум 399⭐ (Opus, 30 слайдов).
- **FSM форма:** 10 шагов пользователя (тема, направление, тип работы, длительность, детализация, тезис, вуз, обязательные элементы, режим, палитра).
- **Оплата:** `send_invoice` → `pre_checkout_query` → `successful_payment` → разблокировать генерацию.
- **Генерация асинхронно:** `send_chat_action(UPLOAD_DOCUMENT)` пока идёт запрос к API.
- **Хранение сессии:** dict `{chat_id: FormData}`, очищать после отдачи файла.

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
