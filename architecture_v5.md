# Архитектура MVP: модуль «Презентация» + TG-бот

> Версия 5. TG Mini App → TG-бот. Дипломные работы убраны окончательно.

---

## История изменений

**v5 (текущая):**
- `[v5]` TG Mini App полностью заменён на классический Telegram-бот (aiogram 3)
- `[v5]` Убран раздел про WebApp/Mini App везде
- `[v5]` Добавлен раздел 5б: архитектура TG-бота (FSM, handlers, States)
- `[v5]` Уточнена структура бэкенда под бота (нет отдельного фронтенда для MVP)
- `[v5]` Оплата: только `send_invoice` через Stars, без WebApp-платёжки
- `[v5]` Уточнён план работ (убран пункт про Mini App, добавлен бот)

**v4:** убран модуль «Работа» и «Антиплагиат», масштаб презентации расширен.
**v3:** разворот на `source_grounded` как главный режим.

---

## 1. Контекст MVP

**Что запускаем:** Telegram-бот для генерации академических презентаций (.pptx).

**Платформа:** классический TG-бот на aiogram 3 + FSM для пошагового сбора данных. Никакого WebApp/Mini App в MVP.

**Масштаб:** от школьного доклада (8–10 слайдов, тема текстом) до академической ВКР по ГОСТу (25–30 слайдов, источник PDF/DOCX).

**Ядро ценности:** студент загружает свою работу → презентация по реальному тексту, каждый слайд привязан к странице источника. Не выдуманные цифры.

**Что не делаем:** написание самих работ. Только презентация по уже написанному.

---

## 2. Тарифы MVP

| | Базовый | Стандарт | Премиум |
|---|---|---|---|
| Цена | 99⭐ | 199⭐ | 399⭐ |
| Слайдов | до 12 | до 20 | до 30 |
| Режимы | `no_template` | + `source_grounded` (≤30 стр.) | все + `source_grounded` (≤100 стр.) |
| Layouts | 8 | 11 | 13 |
| Правки | 2 | 5 | 10 |
| Источники | — | до 3 файлов | до 10 файлов |
| Speaker notes | базовые | развёрнутые | с привязкой к страницам |
| Q&A | — | — | 10 вопросов |
| Модель | Sonnet 4.6 | Sonnet 4.6 | Opus 4.6 |

Оплата через `send_invoice` (Telegram Stars). Telegram удерживает 30% — цены установлены с учётом этого.

---

## 3. Шаблон ввода (сбор через бота)

Бот собирает данные пошагово через FSM. Каждый шаг — одно сообщение бота + ответ пользователя.

### Обязательные поля (8 шагов)
1. Тема работы
2. Направление / предмет
3. Тип работы: `school` / `coursework` / `vkr` / `conference` / `seminar`
4. Длительность выступления (мин) → слайдов: `round(мин / 1.2)`
5. Уровень детализации: `simple` / `standard` / `academic_gost`
6. Ключевой тезис (одним предложением)
7. Уровень + название вуза / школы
8. Режим входа: кнопки inline-keyboard
   - `no_template` — генерирую с нуля
   - `source_grounded` — загружу свою работу (PDF/DOCX)
   - `structure_template` — загружу методичку вуза
   - `design_template` — загружу шаблон оформления

### Опциональные поля (бот спрашивает после обязательных)
9. Что обязательно на слайдах
10. Требования вуза к оформлению
11. Стиль (минималистичный / корпоративный / академический)
12. Дополнительные источники PDF
13. Дата выступления
14. Российские кейсы: да / нет

### FSM States
```python
class FormStates(StatesGroup):
    topic         = State()
    direction     = State()
    work_type     = State()
    duration      = State()
    detail_level  = State()
    key_thesis    = State()
    institution   = State()
    input_mode    = State()
    file_upload   = State()   # если source_grounded / structure_template
    optional_q    = State()   # опциональные вопросы
    payment       = State()
    generating    = State()
```

---

## 4. Layout-система

| Layout | Когда |
|---|---|
| `title_hero` | Титульный слайд |
| `section_break` | Разделитель глав |
| `text_only` | Чистый текст / определения |
| `text_image` | Текст + иллюстрация |
| `bullets` | Маркированный список |
| `stat_callout` | Двухзонный блок с цифрами |
| `timeline` | Хронология / этапы |
| `comparison_table` | Сравнение (premium) |
| `quote` | Цитата из источника |
| `diagram_placeholder` | Место под схему |
| `code_snippet` | Блок кода (IT-специальности) |
| `hero_section` | Акцентный слайд (premium) |
| `conclusion` | Финальный слайд |

Meta JSON каждого слайда:
```json
{
  "slide_index": 3,
  "layout": "stat_callout",
  "title": "Результаты исследования",
  "content": "...",
  "source": "стр. 47, параграф 2.3.1",
  "speaker_notes": "Здесь скажи про методологию..."
}
```

Поле `source` обязательно для `source_grounded`, пустая строка для остальных.

---

## 5. Структура проекта

```
zashitu/
├── bot/
│   ├── main.py                  # точка входа, запуск polling
│   ├── handlers/
│   │   ├── start.py             # /start, главное меню
│   │   ├── form.py              # FSM: сбор данных пошагово
│   │   ├── payment.py           # send_invoice, pre_checkout, successful_payment
│   │   └── generation.py        # запуск генерации, отправка файла
│   ├── keyboards/
│   │   └── inline.py            # все inline-кнопки (режим входа, тарифы, правки)
│   └── states.py                # FormStates (FSM)
├── core/
│   ├── claude_client.py         # обёртка над Anthropic API
│   ├── prompt_builder.py        # сборка промта из модулей
│   └── schema_validator.py      # валидация JSON-ответа от Claude
├── integrations/
│   ├── pdf_extractor.py         # PDF → текст с нумерацией страниц
│   ├── docx_extractor.py        # DOCX → текст с нумерацией страниц
│   └── source_indexer.py        # индексация источника для цитирования
├── generators/
│   ├── pptx_builder.py          # JSON слайдов → .pptx (python-pptx)
│   └── template_filler.py       # очистка плейсхолдеров мастер-слайда
├── prompts/
│   ├── core_v1.md               # базовые инструкции для всех режимов
│   ├── tiers/
│   │   ├── basic_v1.md
│   │   ├── standard_v1.md
│   │   └── premium_v1.md
│   ├── input_mode/
│   │   ├── no_template_v1.md
│   │   ├── source_grounded_v1.md   # главный модуль MVP
│   │   ├── structure_template_v1.md
│   │   └── design_template_v1.md
│   ├── work_type/
│   │   ├── vkr_v1.md
│   │   ├── coursework_v1.md
│   │   ├── seminar_v1.md
│   │   └── school_v1.md
│   └── schemas/
│       └── slide_schema_v1.json    # JSON-схема одного слайда
├── storage/
│   └── user_sessions.py         # временное хранение данных сессии (dict / Redis)
├── config.py                    # BOT_TOKEN, ANTHROPIC_API_KEY, лимиты тарифов
├── requirements.txt
└── .env
```

---

## 6. Критические решения

### 6.1. Выдуманные цифры — решено
`source_grounded`: Claude работает только с текстом источника. Каждое утверждение → `source: стр. X`. `no_template`: плейсхолдеры с пометкой «уточните данные».

### 6.2. Правовые вопросы
Оферта в боте при первом запуске: «Материал справочный, ответственность за сдачу на пользователе». Пользователь нажимает «Принять» → начинает работу.

### 6.3. Длина контекста
Источник 30–100 стр. = 20–60K токенов. Sonnet и Opus 4.6 с контекстом 200K справляются без RAG. Файлы >100 стр. → обрезаем с предупреждением.

### 6.4. AI-картинки
`source_grounded` → всегда выключены. `no_template` + тип `school` → можно включить. Реализуется как флаг в промте.

### 6.5. Хранение сессии
MVP: данные формы хранятся в памяти (dict per chat_id). После отправки файла — очищаем. Для масштаба (этап 2+) — Redis.

### 6.6. Привязка слайд → страница
Каждый слайд: `"source": "стр. 47"`. Фундамент для Q&A (этап 2) — не переделывать, заложить сразу.

### 6.7. Генерация асинхронно
Генерация занимает 15–60 сек. Бот отправляет «Генерирую...» + `send_chat_action(UPLOAD_DOCUMENT)`, затем выдаёт файл. Не блокировать event loop — `asyncio` + `await`.

---

## 7. Технологический стек

| Слой | Технология |
|---|---|
| Telegram-бот | aiogram 3.x (async) |
| AI | Anthropic Python SDK (claude-sonnet-4-6, claude-opus-4-6) |
| PDF парсинг | PyMuPDF (fitz) |
| DOCX парсинг | python-docx |
| PPTX генерация | python-pptx |
| Хранение сессий | dict in-memory (MVP) → Redis (этап 2) |
| Конфиг | python-dotenv + config.py |
| Деплой | systemd / Docker на VPS |

---

## 8. План работ MVP

**Порядок реализации:**

1. Скелет бота: `/start`, FSM-форма для `no_template`, inline-кнопки тарифов
2. `claude_client.py` + `prompt_builder.py` + `schema_validator.py`
3. `pptx_builder.py` — генерация .pptx из JSON слайдов
4. Связать всё: форма → промт → Claude → pptx → отправка файла пользователю
5. `pdf_extractor.py` + `docx_extractor.py` + `source_indexer.py`
6. Добавить режим `source_grounded` в FSM и промты
7. Оплата: `send_invoice` Stars → `pre_checkout_query` → `successful_payment` → разблокировать генерацию
8. Тестирование на 5–10 реальных работах
9. Бета-запуск (20–30 студентов)
10. Публичный запуск

**Что НЕ в MVP:**
- Доклад, Q&A, Тренажёр, Код
- Веб-версия
- Подписки
- Redis (in-memory достаточно)
- `structure_template` и `design_template` — после `source_grounded`

---

## 9. Система промтов

**Самый короткий путь до первой оплаты (7 файлов):**
`core_v1.md` + `premium_v1.md` + `source_grounded_v1.md` + `vkr_v1.md` + `slide_schema_v1.json` + 1 few-shot пример

**Принципы `source_grounded_v1.md`:**
- «Работай ТОЛЬКО с предоставленным текстом источника»
- Каждое утверждение → ссылка на страницу в поле `source`
- Если чего-то нет в источнике → `"content": "[нет в исходной работе]"` + объяснение в `speaker_notes`
- `speaker_notes` содержат прямые цитаты для устного выступления

---

## 10. Метрики успеха MVP

- 10+ оплат за первый месяц после публичного запуска
- ≥70% пользователей скачали файл без жалоб
- Соотношение тарифов ~20/50/30 (базовый/стандарт/премиум)
- Ретеншен 30% за 3 месяца
