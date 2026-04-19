"""Промты для академических типов (ВКР, Курсовая, Семинар, Личный проект).

Эти типы временно скрыты в UI («Скоро»), но остаются как fallback в registry —
чтобы старые тестовые заказы и `_standalone_demo.py` не падали.

Промт следует канону защиты: введение → методология → результаты → выводы.
Тон — академический, source_grounded по умолчанию (опирается на загруженную работу).
"""
from __future__ import annotations

from . import _shared

PRESENTATION_TYPE_LABEL = "Академическая работа"

# Тон зависит от подтипа — для legacy маппим вручную.
LEGACY_TONE = {
    "ВКР":           "академический, строгий. Никаких лишних эмоций и шуток.",
    "Курсовая":      "академический, но более живой. Можно лёгкие эмоциональные акценты.",
    "Семинар":       "дискуссионный. Структура призвана вести к обсуждению.",
    "Личный проект": "уверенная продуктовая, product-demo от первого лица. Живо, без канцелярита.",
}
DEFAULT_TONE = "академический, строгий, без эмоциональных вставок."


PERSONA_BLOCK = """Ты помогаешь подготовить академическую защиту/доклад на основе загруженной работы.
Аудитория — комиссия, научный руководитель, академическое сообщество.
Главное мерило качества — «комиссия может проследить логику от тезиса до выводов и проверить любой факт по странице»."""


STRUCTURAL_CANON_BLOCK = """Канонический скелет академической защиты:

1. **Титульный / тезис** (1 слайд): тема + фамилия + руководитель.
2. **Актуальность / постановка** (1–2 слайда): почему это важно, какая проблема решается.
3. **Цель и задачи** (1 слайд): декомпозиция на проверяемые шаги.
4. **Методология** (1–2 слайда): как именно велось исследование, на чём базируется.
5. **Результаты** (5–10 слайдов): основной массив — таблицы, графики, выводы по каждому пункту задач.
6. **Выводы** (1–2 слайда): подтверждены ли гипотезы, что нового.
7. **Литература / благодарности** — опционально.

ВАЖНО:
- Каждый содержательный слайд → ссылка на страницу источника (source_ref).
- Цитаты автора уместны (`layout=quote`), но без избытка.
- Фамилии цитируемых авторов — в скобках на слайде с их позицией."""


LAYOUT_PREFERENCES_BLOCK = """Для академической защиты — `default`, `stats`, `chart`, `table`, `two_col`, `callout`.
`quote` — экономно, только когда цитата авторитетная.
`section` — между крупными блоками (методология / результаты / выводы)."""


FEW_SHOT_BLOCK = """**A. table — академические данные с ссылкой на страницу**
```json
{"layout": "table",
 "intro": "Сравнение методов кластеризации на тестовом датасете.",
 "headers": ["Метод", "Точность, %", "F1-score", "Время, мс"],
 "rows": [
   ["K-Means",   "82,3", "0,79", "127"],
   ["DBSCAN",    "78,1", "0,76", "342"],
   ["Гибридный", "89,7", "0,87", "198"]
 ],
 "source_ref": "с. 42"}
```

**B. callout — главный вывод**
```json
{"layout": "callout",
 "callout": "Гибридный подход даёт +7,4 п.п. точности при росте времени всего на 56%.",
 "bullets": [
   "Прирост подтверждён на трёх независимых датасетах (n=12 400).",
   "Допустимое время для batch-режима, не подходит для real-time (>200 мс).",
   "Гипотеза H1 подтверждена; H2 требует дополнительной валидации."
 ],
 "source_ref": "с. 47–48"}
```"""


SPEECH_PERSONA_BLOCK = """Ты пишешь текст академического выступления (защита/доклад на конференции).
Тон — академический, точный, без шуток. Структура — актуальность → цель → методы → результаты → выводы.
Каждый ключевой результат — со ссылкой на страницу/раздел источника."""


def build_slides_system_prompt(
    order, *, allow_images: bool, palette_id: str,
) -> str:
    work_type = (getattr(order, "work_type", None) or "").strip()
    work_tone = LEGACY_TONE.get(work_type, DEFAULT_TONE)
    return _shared.compose_slides_system_prompt(
        persona_block=PERSONA_BLOCK,
        structural_canon_block=STRUCTURAL_CANON_BLOCK,
        layout_preferences_block=LAYOUT_PREFERENCES_BLOCK,
        few_shot_block=FEW_SHOT_BLOCK,
        palette_id=palette_id,
        detail_level=getattr(order, "detail_level", "standard"),
        work_tone=work_tone,
        mode=getattr(order, "mode", None) or "source_grounded",
        allow_enhance=bool(getattr(order, "allow_enhance", False)),
        skip_tech_details=bool(getattr(order, "skip_tech_details", False)),
        allow_images=allow_images,
    )


def build_skeleton_system_prompt(order, n_slides: int, allow_images: bool) -> str:
    return _shared.compose_skeleton_system_prompt(
        persona_block=PERSONA_BLOCK,
        structural_canon_block=STRUCTURAL_CANON_BLOCK,
        n_slides=n_slides,
        detail_level=getattr(order, "detail_level", "standard"),
        allow_images=allow_images,
    )


def build_speech_system_prompt(order, duration: int, use_web_search: bool) -> str:
    style_opener_default = "Уважаемая комиссия, тема моей работы…"
    style_closer_default = "Благодарю за внимание. Готов(а) ответить на вопросы."

    base = (
        f"{SPEECH_PERSONA_BLOCK}\n\n"
        "Формат — Markdown с разделами '# Вступление', '# Основная часть', '# Заключение'. "
        f"Открытие: «{style_opener_default}». Закрытие: «{style_closer_default}». "
        f"Длительность {duration} мин — рассчитывай ~120 слов в минуту."
    )
    if getattr(order, "skip_tech_details", False):
        base += (
            " В выступлении НЕ раскрывай технические детали реализации. "
            "На технические вопросы — формулировка «за техническую часть отвечает команда разработки»."
        )
    if use_web_search:
        base += _shared.WEB_SEARCH_BLOCK_FOR_SPEECH
    return base
