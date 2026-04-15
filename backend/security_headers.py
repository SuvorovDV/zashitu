"""Добавляет security-заголовки ко всем HTTP-ответам.

CSP рассчитан на Vite-фронт + axios-запросы к бэку через прокси. Для prod
замените connect-src/ frame-src под реальные домены (Stripe для 3DS-frame).
"""
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp
from starlette.responses import Response


DEFAULT_CSP = (
    "default-src 'self'; "
    "script-src 'self' 'unsafe-inline' https://js.stripe.com; "
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
    "font-src 'self' https://fonts.gstatic.com data:; "
    "img-src 'self' data: blob:; "
    "connect-src 'self' https://api.stripe.com; "
    "frame-src https://js.stripe.com https://hooks.stripe.com; "
    "object-src 'none'; "
    "base-uri 'self'; "
    "form-action 'self'; "
    "frame-ancestors 'none'"
)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: ASGIApp, *, production: bool, csp: str = DEFAULT_CSP):
        super().__init__(app)
        self.production = production
        self.csp = csp

    async def dispatch(self, request, call_next) -> Response:
        response: Response = await call_next(request)
        h = response.headers
        h.setdefault("X-Content-Type-Options", "nosniff")
        h.setdefault("X-Frame-Options", "DENY")
        h.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        h.setdefault(
            "Permissions-Policy",
            "accelerometer=(), camera=(), geolocation=(), gyroscope=(), microphone=(), payment=(self)",
        )
        if self.production:
            h.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
            h.setdefault("Content-Security-Policy", self.csp)
        return response
