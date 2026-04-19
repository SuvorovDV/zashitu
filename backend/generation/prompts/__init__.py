"""Промт-фреймворк генерации презентаций.

Каждый активный тип презентации — отдельный модуль (school_essay, presentation),
описывающий специфическую структуру слайдов и тон спич-генерации.

Общие блоки (JSON-схема, layout decision tree, source-ref правила, anti-patterns,
density floor, web-search-блок) лежат в _shared.py — чтобы базовые правила
оставались синхронными между типами.

Для типов, временно скрытых в UI («Скоро»: ВКР, Курсовая, Семинар, Личный проект),
fallback на academic.py — сохраняет работоспособность для legacy-заказов.

Использование:
    from generation.prompts import get_prompt_module
    pm = get_prompt_module(order.work_type)
    system_prompt = pm.build_slides_system_prompt(order, allow_images=..., palette_id=...)
"""
from . import _shared, academic, presentation, school_essay
from .school_essay import PRESENTATION_TYPE_LABEL as SCHOOL_ESSAY_LABEL
from .presentation import PRESENTATION_TYPE_LABEL as PRESENTATION_LABEL


# Активные в wizard типы.
ACTIVE_TYPES = (SCHOOL_ESSAY_LABEL, PRESENTATION_LABEL)

# Скрыты в wizard как «Скоро».
COMING_SOON_TYPES = ("ВКР", "Курсовая", "Семинар", "Личный проект")


_TYPE_REGISTRY = {
    SCHOOL_ESSAY_LABEL: school_essay,
    PRESENTATION_LABEL: presentation,
    # COMING_SOON_TYPES → academic-fallback ниже через .get(default=academic).
}


def get_prompt_module(work_type: str | None):
    """Возвращает промт-модуль для типа презентации.

    Активные → школьный реферат / обычный доклад.
    Любые другие (включая None, '', coming-soon) → academic-fallback.
    """
    return _TYPE_REGISTRY.get((work_type or "").strip(), academic)


__all__ = [
    "_shared",
    "academic",
    "presentation",
    "school_essay",
    "ACTIVE_TYPES",
    "COMING_SOON_TYPES",
    "get_prompt_module",
]
