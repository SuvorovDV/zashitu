"""Лёгкое структурированное логирование.
В dev — человекочитаемый формат; в prod (DEV_MODE=False) — JSON.
"""
import json
import logging
import sys
from datetime import datetime, timezone


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "ts": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
        }
        if record.exc_info:
            payload["exc"] = self.formatException(record.exc_info)
        for key in ("user_id", "order_id", "event", "path", "method", "status_code"):
            if key in record.__dict__:
                payload[key] = record.__dict__[key]
        return json.dumps(payload, ensure_ascii=False)


def configure_logging(dev_mode: bool) -> None:
    root = logging.getLogger()
    root.setLevel(logging.INFO)
    # Убираем старые обработчики (повторный вызов безопасен)
    for h in list(root.handlers):
        root.removeHandler(h)

    handler = logging.StreamHandler(sys.stdout)
    if dev_mode:
        fmt = logging.Formatter(
            "%(asctime)s %(levelname)-5s [%(name)s] %(message)s",
            datefmt="%H:%M:%S",
        )
        handler.setFormatter(fmt)
    else:
        handler.setFormatter(JsonFormatter())
    root.addHandler(handler)

    # Уменьшаем шум от библиотек
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("watchfiles").setLevel(logging.WARNING)
