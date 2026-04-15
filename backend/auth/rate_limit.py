"""Минимальный in-memory rate limiter для auth-эндпоинтов.
Для prod-кластеров нужен Redis-backend (slowapi/redis). Здесь — базовая защита от брутфорса.
"""
import time
from collections import defaultdict, deque
from typing import Deque, Dict

from fastapi import HTTPException, Request, status


class RateLimiter:
    def __init__(self, limit: int, window_seconds: int):
        self.limit = limit
        self.window = window_seconds
        self._buckets: Dict[str, Deque[float]] = defaultdict(deque)

    def check(self, key: str) -> None:
        now = time.monotonic()
        bucket = self._buckets[key]
        # Удаляем всё, что выпало из окна.
        cutoff = now - self.window
        while bucket and bucket[0] < cutoff:
            bucket.popleft()
        if len(bucket) >= self.limit:
            retry_after = int(bucket[0] + self.window - now) + 1
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many requests. Try again later.",
                headers={"Retry-After": str(retry_after)},
            )
        bucket.append(now)


# 10 попыток входа за 5 минут на IP.
login_limiter = RateLimiter(limit=10, window_seconds=300)
# 5 регистраций за час на IP.
register_limiter = RateLimiter(limit=5, window_seconds=3600)


def _client_key(request: Request) -> str:
    # За прокси — X-Forwarded-For; иначе request.client.host.
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def limit_login(request: Request) -> None:
    login_limiter.check(_client_key(request))


def limit_register(request: Request) -> None:
    register_limiter.check(_client_key(request))
