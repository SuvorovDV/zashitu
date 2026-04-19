"""Общие строительные блоки промтов генерации презентаций.

Каждый активный тип презентации (см. siblings school_essay.py, presentation.py)
собирает свой системный промт через compose_slides_system_prompt(), подставляя
type-specific opening / structural canon / layout preferences / few-shot, но
БАЗОВЫЕ блоки (JSON-схема, layout decision tree, anti-patterns, density floor,
source-ref правила) приходят отсюда — чтобы оставались синхронными между типами.

Качественные апдейты схемы / правил → правишь в одном месте, прилетают всем типам.
"""
from __future__ import annotations

from typing import Optional


# ── Константы, перенесённые из tasks.py ──────────────────────────────────────

PALETTE_MOODS = {
    "midnight_executive": "глубокий синий, строгая корпоративная атмосфера, уверенность",
    "forest_moss":        "зелёный, экологичный и спокойный, природа и рост",
    "coral_energy":       "коралловый, энергичный, современный, маркетинг/стартап",
    "warm_terracotta":    "тёплый терракот, уютно-гуманитарный, история/культура",
    "ocean_gradient":     "морской синий градиент, технологичный, IT/дата",
    "charcoal_minimal":   "угольно-чёрный, минимализм, архитектура/дизайн",
    "teal_trust":         "бирюзовый, доверие, медицина/финансы",
    "berry_cream":        "бордово-кремовый, мягкий, литература/гуманитарные",
    "sage_calm":          "мятный, спокойный и аналитичный, научные данные",
    "cherry_bold":        "тёмно-красный, драматический, политика/социология",
}

DETAIL_DIRECTIVES = {
    "brief":    "2–3 буллета на слайде, короткие (до 10 слов). Телеграфный стиль.",
    "standard": "3–5 буллетов на слайде, по 1–2 предложения. Баланс содержания и лаконичности.",
    "detailed": "4–6 буллетов на слайде, полные предложения с конкретикой (числа, примеры, "
                "названия методов). Можно добавлять пояснения к тезисам.",
}


# ── Универсальные блоки системного промта (общие для ВСЕХ типов) ────────────

DENSITY_FLOOR_BLOCK = """### Density floor
Каждый content-слайд обязан содержать минимум одно из:
(а) число с единицей/процентом («42,3 %», «1,3 млн чел.»),
(б) имя собственное (город/компания/ФИО/профессия/название программы/проекта),
(в) прямая цитата из источника (РЕЧИ или web-источника).
Слайд без (а)/(б)/(в) — вода. Перепиши или замени на layout=section."""


NAMED_ENTITIES_BLOCK = """### Named entities pass
Перед написанием контента — просканируй источник на: города/регионы, компании/ведомства,
ФИО/должности, конкретные числа-годы-проценты, названия программ/исследований/проектов.
Используй их дословно в релевантных слайдах. Не заменяй конкретику на общие слова."""


ANTI_PATTERNS_BLOCK = """### Anti-patterns (НЕ пиши на слайдах)
- Присказки докладчика: «Как мы видим», «Давайте рассмотрим», «В заключение», «Перейдём к…», «Спасибо за внимание».
- Канцелярит: «данный вопрос актуален», «играет важную роль», «в современных реалиях», «имеет место быть».
- Мета-фразы: «на этом слайде», «следующий раздел посвящён».
- Пустые одно-словные буллеты («Анализ», «Проблема», «Решение»)."""


LAYOUT_TREE_BLOCK = """## ВЫБОР LAYOUT (decision tree — сверху вниз, бери ПЕРВОЕ сработавшее)

1. **≥3 числа с единицами/процентами на общую тему** → `stats` (3–4 плитки).
2. **Временной ряд ≥3 точек** («2020: X; 2021: Y; 2022: Z») → `chart`, chart_type: line.
3. **Сравнение ≥3 категорий по одному показателю** → `chart` (bar) или `table`.
4. **Доли одного целого (100 %)** → `chart`, chart_type: pie (до 6 сегментов).
5. **Матрица ≥3 строк × ≥2 колонок** → `table` (до 10 строк, 5 колонок).
6. **Цитата в кавычках / афоризм ≤160 симв** → `quote`.
7. **Переход между блоками / название главы** → `section`.
8. **Противопоставление двух сущностей** (до/после, теория/практика) → `two_col`.
9. **Один сильный тезис + 2–3 пояснения** → `callout`.
10. **Иначе** → `default` с bullets (≤4 буллетов, минимум 1 содержит число/имя/термин).

**ПРИОРИТЕТ:** если данные подходят под stats/chart/table — НИКОГДА не сворачивай их в bullets. Плоский список цифр запрещён.

**Запрет на дублирование:** title и callout не парафразируют друг друга; bullets не пересказывают callout; intro у stats/chart/table даёт контекст и единицу измерения, но не повторяет те же числа, что в плитках/графике/таблице."""


SOURCE_REF_BLOCK = """## ССЫЛКИ НА ИСТОЧНИК

На каждом content-слайде (layouts: default, callout, two_col, stats, table, chart, image_side) поле **`source_ref` ОБЯЗАТЕЛЬНО**.

Формат строго один из:
- `«с. N»` или `«с. N–M»` — страница или диапазон из загруженной работы (если есть)
- `«Росстат, 2023, с. 12»`, `«Иванов, 2024»`, `«ВЦИОМ, 2025»` — внешний источник (из РЕЧИ или web search)
- `«Раздел "<название>"»` — раздел известен, страница нет
- `«источник: загруженная работа»` — fallback, только если страница реально не установлена
- `«общее знание»` — ТОЛЬКО в enhance-режиме, для слайдов на основе общих знаний

Запрещено: «≈ с. 10», «примерно с. 40», «см. материалы», «источники см. в приложении».
Длина source_ref ≤80 симв, без точки в конце.
Для `quote` source_ref не нужен — атрибуция идёт в поле `attribution`: «Иванов И.И., 2020, с. 47».
Для `section` source_ref не нужен (это разделитель, не контент)."""


JSON_SCHEMA_BLOCK = """## СХЕМА JSON

```
default:    {"bullets": ["…"], "source_ref": "с. 12", "image_prompt?": "…"}
callout:    {"callout": "≤120 симв", "bullets": ["…"], "source_ref": "с. 12", "image_prompt?": "…"}
two_col:    {"columns": [{"heading": "…", "bullets": ["…"]}, …], "source_ref": "с. 12"}
section:    {"subtitle": "≤60 симв"}
quote:      {"quote": "≤160 симв", "attribution": "Автор, с. 47"}
stats:      {"intro?": "контекст и единица", "stats": [{"value": "42,3 %", "label": "≤6 слов"}, …], "source_ref": "с. 12"}
table:      {"layout": "table", "intro?": "…", "headers": [...], "rows": [[...]], "source_ref": "Росстат, с. 12"}
chart:      {"layout": "chart", "chart_type": "bar"|"line"|"pie", "intro?": "…", "labels": [...], "series": [{"name": "Показатель, %", "data": [1,2,3]}], "source_ref": "с. 12"}
```

Замечания:
- table: числа с единицами в ячейках («12,4 %», «1 287 тыс.»), имена колонок короткие.
- chart: значения в `data` — числа БЕЗ единиц (единица уходит в `series[].name`: «Безработица, %»). Имена серий ≤20 симв. Bar/line ≤8 точек на серию. Pie ≤6 сегментов.
- layout: table/chart разрешено выставлять самому на слотах default/two_col, если данные того требуют."""


IMAGES_RULE_DECORATIVE = """### Декоративные SVG-акценты (image_prompt)
- Это НЕ основная картинка слайда — это маленький декоративный значок (~5% площади, в углу), оживляющий вёрстку.
- Стиль: абстрактная геометрия — круги, линии, сетки, дуги, силуэт символа тематики. Тонкие линии, никакого реализма.
- На английском. Одно короткое предложение (до 15 слов).
- СТРОГО БЕЗ ТЕКСТА: no text, no words, no letters, no numbers, no captions, no labels, no writing of any kind.
- Ставь image_prompt на 40–60% содержательных слайдов (default/two_col/callout), на ВСЕХ сразу не надо — приедается.
- НЕ ставь image_prompt на layout=section/quote/stats/table/chart (там уже своя визуальная логика).
- Пример: "abstract geometric mark of concentric arcs and a single dot, minimal line art".
- Смысл: намёк на тему слайда, не буквальная иллюстрация. Одну и ту же метафору не повторяй на разных слайдах."""


IMAGES_RULE_DISABLED = """### Изображения
НЕ добавляй поле image_prompt ни на одном слайде — для этого типа презентации иллюстрации не используем."""


# ── Режимы / fact integrity (зависят от order, не от типа) ───────────────────

def build_mode_block(mode: str) -> str:
    """source_grounded — page citations обязательны; no_template — свободнее."""
    if mode == "source_grounded":
        return "Режим source_grounded: source_ref ОБЯЗАТЕЛЕН на каждом content-слайде."
    return "Режим no_template: source_ref не требуется, но web-источники цитируй там, где факты пришли из поиска."


def build_enhance_block(allow_enhance: bool) -> tuple[str, str]:
    """Возвращает (enhance_rule, fact_integrity_mode) — те же блоки, что и в legacy."""
    if allow_enhance:
        enhance_rule = (
            "Разрешено дополнять контент фактами из общих знаний (статистика, исторический контекст, "
            "общеизвестные факты, примеры профессий/кейсов).\n"
            "\n"
            "КРИТИЧЕСКОЕ ПРАВИЛО АТРИБУЦИИ — соблюдай буквально:\n"
            "1. Перед написанием каждого слайда ЧЕСТНО ответь: содержится ли ЯВНО эта формулировка/факт в источнике?\n"
            "2. Если ДА — source_ref указывает место в источнике («с. N», «Раздел \"…\"», «<автор>, год»).\n"
            "3. Если НЕТ (ты дополнил собой) — source_ref ОБЯЗАН быть буквально «общее знание». Без вариаций.\n"
            "4. Ложная атрибуция (поставить «источник: загруженная работа» на дополненный слайд) — главная ошибка, "
            "подрывающая продуктовое обещание.\n"
            "5. Смешивание в одном буллете тезисов из источника и «общих знаний» запрещено — разводи на разные слайды."
        )
        fact_integrity = (
            "Fact integrity (enhance-режим): цифры/имена/даты/примеры из источника — воспроизводи точно. "
            "На enhance-слайдах (source_ref = «общее знание») — консервативно: диапазоны вместо точных цифр, "
            "без выдуманных ФИО и специфических процентов без опоры на авторитетные источники."
        )
    else:
        enhance_rule = "СТРОГО из источника: никаких фактов, цифр, имён, дат — не встречающихся в источнике."
        fact_integrity = (
            "Fact integrity (строгий режим): ни одного числа/имени/даты вне источника. "
            "Каждая named entity ДОЛЖНА встречаться буквально или как морфологическая форма."
        )
    return enhance_rule, fact_integrity


def build_tech_gate(skip_tech_details: bool) -> str:
    if not skip_tech_details:
        return ""
    return (
        "\n- На слайдах НЕ раскрывай технические детали реализации "
        "(стек, архитектура, БД, конкретные библиотеки, код). "
        "Говори о продукте, решениях и пользовательских сценариях."
    )


# ── Speech-context block (тот же для всех типов; отличается только tone) ────

def build_speech_context_block(order) -> str:
    """Если речь утверждена — собираем её в источник для slide-генерации."""
    if not (
        getattr(order, "include_speech", False)
        and getattr(order, "speech_approved", False)
        and getattr(order, "speech_text", None)
    ):
        return ""
    return (
        "\n\nУтверждённый пользователем ТЕКСТ ВЫСТУПЛЕНИЯ (далее — «РЕЧЬ»):\n"
        "```markdown\n"
        f"{order.speech_text[:40000]}\n"
        "```\n\n"
        "ЖЁСТКИЕ ПРАВИЛА СВЯЗИ слайдов с РЕЧЬЮ:\n"
        "1. Каждый bullet слайда — краткая переформулировка конкретной фразы/абзаца РЕЧИ. "
        "Никаких новых фактов, цифр, имён, дат — только то, что ДОКЛАДЧИК ПРОИЗНЕСЁТ.\n"
        "2. Если в РЕЧИ есть markdown-таблица — ОБЯЗАТЕЛЬНО воспроизведи её как отдельный слайд "
        "с `layout: \"table\"` (headers и rows строго по данным из РЕЧИ).\n"
        "3. Если в РЕЧИ есть числовой ряд с годами/категориями (ASCII-график, явный список «2020: 7,0%, 2021: 5,4%…», "
        "или таблица с временным столбцом) — воспроизведи в `layout: \"chart\"` "
        "(chart_type: line для времени, bar для категорий, pie для долей).\n"
        "4. Порядок слайдов следует логике РЕЧИ.\n"
        "5. Выразительные цитаты в кавычках из РЕЧИ — кандидаты на `layout: \"quote\"`.\n"
        "6. Если в секции скелета нет материала в РЕЧИ — используй ближайшую по смыслу часть, "
        "но НЕ придумывай содержимое с нуля."
    )


def build_revision_hint_slides(order) -> str:
    if getattr(order, "slides_revision_note", None):
        return (
            f"\n\nПожелания пользователя к этой версии слайдов:\n«{order.slides_revision_note}»\n"
            "Обязательно учти их (не нарушая ограничение: ничего нового, чего нет в источнике)."
        )
    if getattr(order, "slides_revisions", 0) > 0:
        return f"\n\nЭто пересборка #{order.slides_revisions}. Поменяй формулировки относительно предыдущей версии."
    return ""


def build_revision_hint_speech(order) -> str:
    hint = ""
    if getattr(order, "speech_revisions", 0) > 0:
        hint += (
            f"\n\nЭто пересборка #{order.speech_revisions}. Сделай её заметно отличающейся "
            "от предыдущей версии по формулировкам и структуре."
        )
    if getattr(order, "speech_revision_note", None):
        hint += (
            f"\n\nПожелания пользователя к этой версии:\n«{order.speech_revision_note}»\n"
            "Обязательно учти их."
        )
    return hint


def build_custom_part_slides(order) -> str:
    if not getattr(order, "custom_elements", None):
        return ""
    return f"\n\nПользователь просит обязательно отразить в слайдах:\n«{order.custom_elements}»"


def build_custom_part_speech(order) -> str:
    if not getattr(order, "custom_elements", None):
        return ""
    return (
        f"\n\nДополнительно пользователь просит обязательно включить в выступление:\n"
        f"«{order.custom_elements}»"
    )


# ── Web search block для спич-генерации (no-source режим) ────────────────────

WEB_SEARCH_BLOCK_FOR_SPEECH = (
    "\n\n=== ВАЖНО: НЕТ ЗАГРУЖЕННОЙ РАБОТЫ ===\n"
    "У пользователя нет PDF/DOCX с исходной работой — ты пишешь речь с нуля по теме.\n"
    "Чтобы избежать выдуманных фактов:\n"
    "1. Перед написанием сделай 2-3 поиска через web_search на русском по теме "
    "(статистика, актуальные исследования, имена учёных, отраслевые отчёты, "
    "данные министерств/Росстата/ВОЗ/ОЭСР — что релевантно).\n"
    "2. Используй ТОЛЬКО факты из найденных источников. Числа, годы, ФИО, "
    "названия организаций — всё должно быть подтверждено поиском.\n"
    "3. Цитируй источник прямо в тексте речи в скобках: (Иванов, 2024), "
    "(Минобрнауки РФ, 2025), (ВЦИОМ, 2024).\n"
    "4. Если по узкому аспекту нет надёжных данных — скажи общими словами без "
    "конкретики, не выдумывай. Лучше «по оценкам экспертов» без цифры, чем "
    "выдуманная цифра.\n"
    "5. Не вставляй URL в текст речи — только автор/организация и год."
)


# ── Композитор системного промта для слайдов (вызывается типовыми модулями) ─

def compose_slides_system_prompt(
    *,
    persona_block: str,
    structural_canon_block: str,
    layout_preferences_block: str,
    few_shot_block: str,
    palette_id: str,
    detail_level: str,
    work_tone: str,
    mode: str,
    allow_enhance: bool,
    skip_tech_details: bool,
    allow_images: bool,
) -> str:
    """Собирает финальный system_prompt из type-specific и общих блоков.

    persona_block — кто ты, для кого пишешь, базовый тон. Type-specific.
    structural_canon_block — структурный канон (что-почему-как / контекст-идея-…). Type-specific.
    layout_preferences_block — какие layouts фавориты для типа (школа: callout/quote; доклад: stats/chart). Type-specific.
    few_shot_block — 2-3 эталонных слайда уровня плотности, которой ждём. Type-specific.

    Остальное — из shared (JSON-схема, anti-patterns, source ref, density floor).
    """
    palette_mood = PALETTE_MOODS.get(palette_id, "нейтральный академический")
    detail_directive = DETAIL_DIRECTIVES.get(detail_level or "standard", DETAIL_DIRECTIVES["standard"])
    mode_rule = build_mode_block(mode)
    enhance_rule, fact_integrity = build_enhance_block(allow_enhance)
    tech_gate = build_tech_gate(skip_tech_details)
    images_rule = IMAGES_RULE_DECORATIVE if allow_images else IMAGES_RULE_DISABLED

    return f"""{persona_block}

## Общие правила
- Язык: русский. Никаких «Слайд N», «Презентация», вводных формул вроде «Добро пожаловать».
- Тон: {work_tone}
- Палитра: {palette_id} — {palette_mood}. Подбирай слова под настроение.
- Плотность: {detail_directive}
- {mode_rule}{tech_gate}
- Ответ — ТОЛЬКО валидный JSON-массив, без ```markdown```.

## 1. КРИТЕРИИ КАЧЕСТВА СЛАЙДА (самое важное)

{NAMED_ENTITIES_BLOCK}

{DENSITY_FLOOR_BLOCK}

### Fact integrity
{fact_integrity}
- Если в источнике есть диапазон («40–50 %») — передавай диапазон, не усредняй.
- Единицы измерения — только те, что в источнике.
- Сомневаешься в факте — не вставляй вообще. Лучше буллет меньше, чем выдуманный.

### Режим наполнения
{enhance_rule}

{ANTI_PATTERNS_BLOCK}

## 2. СТРУКТУРНЫЙ КАНОН (тип-специфичный)

{structural_canon_block}

## 3. LAYOUT — приоритеты для этого типа
{layout_preferences_block}

{LAYOUT_TREE_BLOCK}

{SOURCE_REF_BLOCK}

## 4. СХЕМА JSON

{JSON_SCHEMA_BLOCK}

{images_rule}

## 5. ЭТАЛОННАЯ ПЛОТНОСТЬ (few-shot для этого типа)

{few_shot_block}
"""


def build_slides_user_prompt(order, skeleton: list, type_label: str) -> str:
    """Универсальный user prompt — параметры заказа + скелет."""
    sections_list = "\n".join(
        f"{i+1}. [{s['layout']}] {s['name']}" for i, s in enumerate(skeleton)
    )
    presenter_line = ""
    if getattr(order, "presenter_name", None) or getattr(order, "presenter_role", None):
        presenter_line = (
            f"- Докладчик: {order.presenter_name or '—'}"
            f"{', ' + order.presenter_role if order.presenter_role else ''}\n"
        )
    speech_context = build_speech_context_block(order)
    custom_part = build_custom_part_slides(order)
    revision_hint = build_revision_hint_slides(order)

    return f"""Параметры презентации:
- Тема: {order.topic}
{presenter_line}- Тип презентации: {type_label}
- Направление: {getattr(order, 'direction', None) or 'не указано'}
- Учебное заведение / организация: {getattr(order, 'university', None) or 'не указано'}
- Тезис/гипотеза: {getattr(order, 'thesis', None) or 'не указан'}
- Детальность: {getattr(order, 'detail_level', None) or 'standard'}
- Режим: {getattr(order, 'mode', None) or 'source_grounded'}
- Палитра: {getattr(order, 'palette', None) or 'midnight_executive'}
- Длительность выступления: {getattr(order, 'duration_minutes', None) or '—'} мин
- Количество слайдов: {len(skeleton)}{custom_part}{speech_context}{revision_hint}

Структура слайдов (layout определяет формат):
{sections_list}

Сгенерируй JSON-массив ровно из {len(skeleton)} объектов в указанном порядке.
Верни только JSON-массив, без пояснений."""
