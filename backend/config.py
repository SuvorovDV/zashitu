import secrets
from typing import Any, Dict

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://zashitu:zashitu_pass@localhost:5432/zashitu_db"
    REDIS_URL: str = "redis://localhost:6379/0"
    CELERY_BROKER_URL: str = "redis://localhost:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/0"

    # Заполняется генератором в dev; в prod обязателен явный SECRET_KEY в ENV.
    SECRET_KEY: str = ""
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Cookies: по умолчанию безопасные (HTTPS). В dev можно выключить через .env.
    COOKIE_SECURE: bool = True
    COOKIE_SAMESITE: str = "lax"

    STRIPE_SECRET_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""

    ANTHROPIC_API_KEY: str = ""

    # Для генерации иллюстраций слайдов (tool-belt ai-image-generation skill).
    # Если пусто — image_prompt'ы игнорируются и слайды без картинок.
    OPENAI_API_KEY: str = ""
    IMAGE_MODEL: str = "gpt-image-1"
    IMAGE_SIZE: str = "1024x1024"

    FRONTEND_URL: str = "http://localhost:5173"

    UPLOAD_DIR: str = "uploads"
    OUTPUT_DIR: str = "outputs"
    MAX_FILE_SIZE_MB: int = 20

    GENERATION_MODE: str = "mock"
    ZASHITU_PATH: str = "../zashitu"

    ALLOWED_HOSTS: str = "*"

    CELERY_TASK_ALWAYS_EAGER: bool = False
    DEV_MODE: bool = False
    # Обязательный токен для /dev/* эндпоинтов, если DEV_MODE=True.
    # Передаётся клиентом в заголовке X-Dev-Token.
    DEV_TOKEN: str = ""

    # Telegram-бот ходит по тем же эндпоинтам, что и фронт, но без cookies.
    # Заголовок X-Bot-Secret проверяется в get_current_user; при совпадении
    # запрос выполняется от имени сервисного пользователя (создаётся лениво).
    BOT_INTERNAL_SECRET: str = ""
    BOT_SERVICE_USER_EMAIL: str = "bot@zashitu.internal"

    # NER-валидатор: объективный бэкстоп для галлюцинаций (города/компании/числа/ФИО).
    # Сейчас — только логирование (без retry/reject). Можно выключить для регрессии.
    NER_VALIDATE_ENABLED: bool = True

    # Web search для спич-генерации в no-source режиме (юзер не загрузил работу).
    # Когда True и нет UploadedFile → Claude дёргает web_search_20250305 (server-side),
    # ищет 2-3 авторитетных источника по теме, цитирует автора/год в речи.
    # Если PDF есть — флаг игнорируется (источник студента приоритетнее веба).
    WEB_SEARCH_ENABLED: bool = True
    # Сколько раз Claude может вызвать web_search за один запрос. Anthropic тарифицирует
    # $10/1000 поисков. 3 хватает для обзорной речи; задирать > 5 — растёт латенси.
    WEB_SEARCH_MAX_USES: int = 3

    class Config:
        env_file = ".env"
        extra = "ignore"

    @field_validator("COOKIE_SAMESITE")
    @classmethod
    def _check_samesite(cls, v: str) -> str:
        v = v.lower()
        if v not in {"lax", "strict", "none"}:
            raise ValueError("COOKIE_SAMESITE must be one of: lax, strict, none")
        return v

    @model_validator(mode="after")
    def _resolve_secrets(self) -> "Settings":
        # SECRET_KEY: в dev авто-генерация с предупреждением; в prod — ошибка.
        if not self.SECRET_KEY:
            if self.DEV_MODE:
                self.SECRET_KEY = secrets.token_urlsafe(48)
                print("WARN: SECRET_KEY auto-generated for DEV_MODE. Tokens invalidate on restart.")
            else:
                raise RuntimeError(
                    "SECRET_KEY is required in production. "
                    "Set SECRET_KEY in .env (use `python -c 'import secrets; print(secrets.token_urlsafe(48))'`)."
                )

        # DEV_MODE + пустой DEV_TOKEN → генерируем и печатаем (чтобы руками скопировать в Postman/фронт).
        if self.DEV_MODE and not self.DEV_TOKEN:
            self.DEV_TOKEN = secrets.token_urlsafe(24)
            print(f"DEV_TOKEN auto-generated: {self.DEV_TOKEN}")
            print("Use header 'X-Dev-Token: <value>' to call /dev/* endpoints.")

        # Dev-разрешение запуска по HTTP: COOKIE_SECURE=False допустим только при DEV_MODE.
        if not self.COOKIE_SECURE and not self.DEV_MODE:
            raise RuntimeError("COOKIE_SECURE=False is only allowed when DEV_MODE=True.")

        # Stripe опционален: если не сконфигурирован, чекаут вернёт 503 на runtime
        # (см. payments/service.py). Это штатно для запуска без оплаты.
        if not self.DEV_MODE and not self.STRIPE_SECRET_KEY:
            print("WARN: STRIPE_SECRET_KEY not set — payments disabled, checkout will 503.")

        return self

    @property
    def max_file_size_bytes(self) -> int:
        return self.MAX_FILE_SIZE_MB * 1024 * 1024


settings = Settings()

TIERS: Dict[str, Any] = {
    "basic": {
        "price_cents": 100,
        "price_rub": 99,
        "slides": 12,
        "max_slides": 12,
        "max_duration_minutes": 15,
        "model": "claude-sonnet-4-6",
        "label": "Базовый",
    },
    "standard": {
        "price_cents": 200,
        "price_rub": 199,
        "slides": 20,
        "max_slides": 20,
        "max_duration_minutes": 25,
        "model": "claude-sonnet-4-6",
        "label": "Стандарт",
    },
    "premium": {
        "price_cents": 400,
        "price_rub": 399,
        "slides": 30,
        "max_slides": 30,
        "max_duration_minutes": 45,
        "model": "claude-opus-4-7",
        "label": "Премиум",
    },
}

# Упорядочены по возрастанию — удобно искать минимальный подходящий тариф.
TIER_ORDER = ["basic", "standard", "premium"]


def min_tier_for(slides_count: int | None, duration_minutes: int | None) -> str:
    """Возвращает id минимального тарифа, который покрывает запрошенный объём."""
    for tier_id in TIER_ORDER:
        cfg = TIERS[tier_id]
        if slides_count and slides_count > cfg["max_slides"]:
            continue
        if duration_minutes and duration_minutes > cfg["max_duration_minutes"]:
            continue
        return tier_id
    return TIER_ORDER[-1]

# Оценка себестоимости генерации через Claude API.
# Sonnet: $3 input / $15 output за миллион токенов.
# Opus:   $15 input / $75 output за миллион токенов.
# Средний запрос: ~2000 input токенов + 3000 output. Speech ещё +3500 output.
# При курсе 100 ₽/$ себестоимость в рублях (округлённо вверх):
#   basic:    ~5 ₽ / +5 ₽ за текст   = 5-10 ₽
#   standard: ~5 ₽ / +5 ₽ за текст   = 5-10 ₽
#   premium:  ~25 ₽ / +25 ₽ за текст = 25-50 ₽
COST_ESTIMATE_RUB: Dict[str, Dict[str, int]] = {
    "basic":    {"slides_only": 5,  "with_speech": 10},
    "standard": {"slides_only": 5,  "with_speech": 10},
    "premium":  {"slides_only": 25, "with_speech": 50},
}
