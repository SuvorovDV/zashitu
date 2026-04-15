from dataclasses import dataclass, field
from typing import Optional


@dataclass
class FormData:
    """Состояние формы в процессе сбора. После создания заказа на бэкенде
    сюда пишется order_id, и далее бот работает только через backend API."""

    # Поля формы — имена совпадают с CreateOrderRequest на бэкенде.
    topic: str = ""
    direction: str = ""
    work_type: str = ""             # 'ВКР' | 'Курсовая' | ...
    duration_minutes: int = 0
    slides_count: int = 0           # override; 0 = не задано
    detail_level: str = ""          # 'brief' | 'standard' | 'detailed'
    thesis: str = ""
    university: str = ""
    custom_elements: str = ""
    mode: str = ""                  # 'source_grounded' | 'no_template'
    palette: str = "midnight_executive"
    tier: str = ""

    # Технические
    order_id: str = ""              # id заказа после POST /orders
    file_uploaded: bool = False     # отправили ли файл на /files/upload
    terms_accepted: bool = False


_sessions: dict[int, FormData] = {}


def get_session(chat_id: int) -> FormData:
    if chat_id not in _sessions:
        _sessions[chat_id] = FormData()
    return _sessions[chat_id]


def reset_session(chat_id: int) -> FormData:
    """Оставляем terms_accepted, остальное сбрасываем."""
    prev = _sessions.get(chat_id)
    fresh = FormData()
    if prev:
        fresh.terms_accepted = prev.terms_accepted
    _sessions[chat_id] = fresh
    return fresh


def clear_session(chat_id: int) -> None:
    _sessions.pop(chat_id, None)
