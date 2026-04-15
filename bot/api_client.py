"""Тонкий клиент FastAPI-бэкенда zashitu-web.

Все запросы идут с заголовком X-Bot-Secret; бэкенд в get_current_user
резолвит его в сервисного пользователя (один на весь бот). Маппинг
telegram_id → order_id бот хранит у себя (user_sessions)."""
from __future__ import annotations

from typing import Any

import httpx

from config import BACKEND_URL, BACKEND_INTERNAL_SECRET


_HEADERS = {"X-Bot-Secret": BACKEND_INTERNAL_SECRET}
_TIMEOUT = httpx.Timeout(30.0, connect=10.0)


def _client() -> httpx.AsyncClient:
    return httpx.AsyncClient(base_url=BACKEND_URL, headers=_HEADERS, timeout=_TIMEOUT)


class BackendError(RuntimeError):
    def __init__(self, status: int, detail: str):
        super().__init__(f"backend {status}: {detail}")
        self.status = status
        self.detail = detail


def _raise_for(resp: httpx.Response) -> None:
    if resp.is_success:
        return
    try:
        detail = resp.json().get("detail", resp.text)
    except Exception:
        detail = resp.text
    raise BackendError(resp.status_code, str(detail))


async def create_order(payload: dict[str, Any]) -> str:
    async with _client() as c:
        resp = await c.post("/orders/", json=payload)
    _raise_for(resp)
    return resp.json()["id"]


async def upload_file(order_id: str, filename: str, content: bytes, mime: str) -> None:
    async with _client() as c:
        resp = await c.post(
            f"/files/upload/{order_id}",
            files={"file": (filename, content, mime)},
        )
    _raise_for(resp)


async def confirm_payment(order_id: str) -> None:
    async with _client() as c:
        resp = await c.post("/payments/internal/confirm", json={"order_id": order_id})
    _raise_for(resp)


async def get_status(order_id: str) -> dict[str, Any]:
    async with _client() as c:
        resp = await c.get(f"/generation/status/{order_id}")
    _raise_for(resp)
    return resp.json()


async def download_pptx(order_id: str) -> tuple[bytes, str]:
    """Возвращает (content, filename). filename — из заголовка Content-Disposition."""
    async with _client() as c:
        resp = await c.get(f"/files/download/{order_id}")
    _raise_for(resp)
    filename = "presentation.pptx"
    cd = resp.headers.get("content-disposition", "")
    # Формат: attachment; filename="Tezis_X.pptx" или filename*=UTF-8''...
    if "filename=" in cd:
        part = cd.split("filename=", 1)[1].split(";", 1)[0].strip().strip('"')
        if part:
            filename = part
    return resp.content, filename
