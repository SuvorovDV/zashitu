import os
from dotenv import load_dotenv

load_dotenv()

BOT_TOKEN: str = os.environ["BOT_TOKEN"]

# Бэкенд zashitu-web: бот — тонкий клиент его API.
BACKEND_URL: str = os.environ.get("BACKEND_URL", "http://localhost:8000").rstrip("/")
BACKEND_INTERNAL_SECRET: str = os.environ["BACKEND_INTERNAL_SECRET"]

# Если True — бот пропускает отправку Stars-счёта и сразу подтверждает оплату
# через /payments/internal/confirm. Удобно для локальной разработки.
DEBUG_SKIP_PAYMENT: bool = os.getenv("DEBUG_SKIP_PAYMENT", "false").lower() == "true"

# Прокси к api.telegram.org (Cloudflare Worker) — для хостинга в РФ,
# где api.telegram.org заблокирован. Пусто → прямое соединение.
TELEGRAM_API_SERVER: str = os.getenv("TELEGRAM_API_SERVER", "").strip()

# Тарифы — значения синхронизированы с zashitu-web/backend/config.py TIERS.
# В рублях web использует price_rub — здесь это цена в Stars (1⭐ ≈ 1₽ в UI).
TIERS = {
    "basic": {
        "price_stars": 99,
        "max_slides": 12,
        "max_duration_minutes": 15,
        "label": "Базовый — 99⭐",
        "short": "Базовый",
    },
    "standard": {
        "price_stars": 199,
        "max_slides": 20,
        "max_duration_minutes": 25,
        "label": "Стандарт — 199⭐",
        "short": "Стандарт",
    },
    "premium": {
        "price_stars": 399,
        "max_slides": 30,
        "max_duration_minutes": 45,
        "label": "Премиум — 399⭐",
        "short": "Премиум",
    },
}

# Значения ниже отправляются на backend как есть — должны совпадать с тем,
# что шлёт фронт zashitu-web (иначе генерация/тональность сломается).

# Ключ соответствует тексту кнопки; value — то, что уходит в API.
WORK_TYPES = {
    "🎓 ВКР / Дипломная":      "ВКР",
    "📝 Курсовая":             "Курсовая",
    "🏫 Школьный реферат":     "Школьный реферат",
    "💬 Семинар":              "Семинар",
    "🚀 Личный проект":        "Личный проект",
}

# Бэкенд ожидает brief/standard/detailed. Detailed — только для Premium.
DETAIL_LEVELS = {
    "Краткий":   "brief",
    "Стандарт":  "standard",
    "Подробный (только Премиум)": "detailed",
}

INPUT_MODES = {
    "📎 По моей работе (PDF/DOCX)": "source_grounded",
    "✨ Генерировать с нуля":        "no_template",
}

# 10 палитр, совпадают с frontend/src/components/wizard/steps/Step10Palette.jsx
PALETTES = {
    "🌌 Midnight Executive":   "midnight_executive",
    "🌲 Forest & Moss":        "forest_moss",
    "🔴 Coral Energy":         "coral_energy",
    "🟧 Warm Terracotta":      "warm_terracotta",
    "🌊 Ocean Gradient":       "ocean_gradient",
    "⬛ Charcoal Minimal":     "charcoal_minimal",
    "🩵 Teal Trust":           "teal_trust",
    "🍒 Berry & Cream":        "berry_cream",
    "🌿 Sage Calm":            "sage_calm",
    "❤️ Cherry Bold":          "cherry_bold",
}
