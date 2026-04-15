import logging
import os
import time
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware

from config import settings
from database import create_tables
from logging_config import configure_logging
from security_headers import SecurityHeadersMiddleware
from auth.router import router as auth_router
from orders.router import router as orders_router
from payments.router import router as payments_router
from generation.router import router as generation_router
from files.router import router as files_router

configure_logging(settings.DEV_MODE)
log = logging.getLogger("zashitu.http")


@asynccontextmanager
async def lifespan(app: FastAPI):
    Path(settings.UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
    Path(settings.OUTPUT_DIR).mkdir(parents=True, exist_ok=True)
    await create_tables()
    yield


app = FastAPI(title="ZaShitu API", lifespan=lifespan)

# TrustedHost: в проде ограничиваем Host-заголовок (защита от host-header инъекций).
_allowed_hosts = [h.strip() for h in settings.ALLOWED_HOSTS.split(",") if h.strip()]
if not _allowed_hosts or _allowed_hosts == ["*"]:
    _allowed_hosts = ["*"]
app.add_middleware(TrustedHostMiddleware, allowed_hosts=_allowed_hosts)

app.add_middleware(SecurityHeadersMiddleware, production=not settings.DEV_MODE)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def request_log_middleware(request: Request, call_next):
    start = time.monotonic()
    response = await call_next(request)
    duration_ms = int((time.monotonic() - start) * 1000)
    log.info(
        f"{request.method} {request.url.path} -> {response.status_code} ({duration_ms}ms)",
        extra={
            "event": "http",
            "method": request.method,
            "path": request.url.path,
            "status_code": response.status_code,
        },
    )
    return response


@app.get("/health")
async def health():
    return {"status": "ok", "dev_mode": settings.DEV_MODE}


app.include_router(auth_router)
app.include_router(orders_router)
app.include_router(payments_router)
app.include_router(generation_router)
app.include_router(files_router)

if settings.DEV_MODE:
    from dev_router import router as dev_router
    app.include_router(dev_router)
    print("DEV MODE: /dev/* endpoints enabled (Stripe bypass available)")


