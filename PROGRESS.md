# PROGRESS.md — статус реализации

Обновляй этот файл после каждой рабочей сессии.

---

## Следующий шаг

**→ Сначала исправить 3 критических бага** (см. раздел "Критические баги"), потом e2e тест:

```bash
# Добавить в .env:
DEBUG_SKIP_PAYMENT=true
DEBUG_RETURN_PROMPT=true   # чтобы сначала проверить промт без вызова API

# Запустить:
.venv/Scripts/python.exe bot/main.py
```

Пройти флоу: `/start` → 10 шагов → выбрать тариф → убедиться что .pptx отдаётся.

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

## Лог изменений

| Дата | Что сделано |
|---|---|
| 2026-04-13 | Добавлены: ВКР-обязательный source_grounded (auto-routing в FSM), генерация текста доклада (.txt) с источниками. Полный аудит: исправлены 4 бага (vkr в config, conference промт, лишний импорт). |
| 2026-04-12 | Реализован полный MVP-скелет: бот, FSM, core, генераторы, интеграции, промты. Все зависимости установлены. Бот запускается, ждёт активации токена. |
