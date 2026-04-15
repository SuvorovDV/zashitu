from aiogram.types import (
    InlineKeyboardMarkup, InlineKeyboardButton,
    ReplyKeyboardMarkup, KeyboardButton, ReplyKeyboardRemove,
)
from config import TIERS, WORK_TYPES, DETAIL_LEVELS, INPUT_MODES, PALETTES

BTN_BACK = "← Назад"
BTN_CREATE = "🎓 Создать презентацию"
BTN_HOW = "ℹ️ Как это работает"
BTN_SLIDES = "📊 Указать кол-во слайдов"
BTN_GENERATE = "✅ Оплатить и получить"
BTN_EDIT = "✏️ Изменить данные"
BTN_SKIP = "Пропустить →"
BTN_NO_TEMPLATE_FILE = "Без файла (no_template)"

DURATION_PRESETS = ["5 мин", "7 мин", "10 мин", "15 мин", "20 мин", "30 мин"]


def _rows(labels: list[str], add_back: bool = True) -> list[list[KeyboardButton]]:
    rows = [[KeyboardButton(text=t)] for t in labels]
    if add_back:
        rows.append([KeyboardButton(text=BTN_BACK)])
    return rows


def kb_main() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        keyboard=[[KeyboardButton(text=BTN_CREATE)], [KeyboardButton(text=BTN_HOW)]],
        resize_keyboard=True,
        input_field_placeholder="Выбери действие...",
    )


def kb_back() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        keyboard=[[KeyboardButton(text=BTN_BACK)]], resize_keyboard=True
    )


def kb_work_type() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(keyboard=_rows(list(WORK_TYPES.keys())), resize_keyboard=True)


def kb_duration() -> ReplyKeyboardMarkup:
    rows: list[list[KeyboardButton]] = []
    for i in range(0, len(DURATION_PRESETS), 3):
        rows.append([KeyboardButton(text=t) for t in DURATION_PRESETS[i:i + 3]])
    rows.append([KeyboardButton(text=BTN_SLIDES)])
    rows.append([KeyboardButton(text=BTN_BACK)])
    return ReplyKeyboardMarkup(keyboard=rows, resize_keyboard=True)


def kb_detail_level() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(keyboard=_rows(list(DETAIL_LEVELS.keys())), resize_keyboard=True)


def kb_custom_elements() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text=BTN_SKIP)],
            [KeyboardButton(text=BTN_BACK)],
        ],
        resize_keyboard=True,
        input_field_placeholder="Напиши или пропусти...",
    )


def kb_mode() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(keyboard=_rows(list(INPUT_MODES.keys())), resize_keyboard=True)


def kb_palette() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(keyboard=_rows(list(PALETTES.keys())), resize_keyboard=True)


def kb_tiers() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        keyboard=_rows([t["label"] for t in TIERS.values()]),
        resize_keyboard=True,
    )


def kb_confirm() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text=BTN_GENERATE)],
            [KeyboardButton(text=BTN_EDIT)],
        ],
        resize_keyboard=True,
    )


def kb_file_upload() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        keyboard=[[KeyboardButton(text=BTN_BACK)]], resize_keyboard=True
    )


def kb_remove() -> ReplyKeyboardRemove:
    return ReplyKeyboardRemove()


def kb_accept_terms() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="✅ Принять и продолжить", callback_data="accept_terms")],
    ])
