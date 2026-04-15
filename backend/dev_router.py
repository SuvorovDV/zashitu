"""
DEV ONLY — роутер для тестирования без Stripe.
Подключается только когда DEV_MODE=True в .env.
Все эндпоинты требуют заголовок X-Dev-Token, совпадающий с settings.DEV_TOKEN.
"""
import hmac
from typing import Optional
from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from config import TIERS, settings
from database import get_db
from models import OrderStatus
from orders import service as orders_service
from generation.service import enqueue_generation

router = APIRouter(prefix="/dev", tags=["dev"])


def require_dev_token(x_dev_token: Optional[str] = Header(default=None)) -> None:
    expected = settings.DEV_TOKEN
    if not expected:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="DEV_TOKEN is not configured")
    if not x_dev_token or not hmac.compare_digest(x_dev_token, expected):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or missing X-Dev-Token header")


class DevPayBody(BaseModel):
    tier: Optional[str] = None


@router.post("/complete-payment/{order_id}", dependencies=[Depends(require_dev_token)])
async def dev_complete_payment(
    order_id: str,
    body: DevPayBody = DevPayBody(),
    db: AsyncSession = Depends(get_db),
):
    """
    Симулирует успешную оплату: обновляет тариф (если передан),
    переводит заказ в статус paid и ставит задачу генерации.
    Требует заголовок X-Dev-Token.
    """
    order = await orders_service.get_order_by_id(db, order_id)
    if not order:
        raise HTTPException(status_code=404, detail=f"Order {order_id!r} not found in DB")

    # Идемпотентность: не переиграть оплату если уже paid/generating/done.
    if order.status != OrderStatus.pending.value:
        return {
            "ok": True,
            "order_id": order_id,
            "tier": order.tier,
            "status": order.status,
            "message": "Order already past pending — no-op",
        }

    if body.tier and body.tier in TIERS:
        order.tier = body.tier
        await db.commit()

    await orders_service.update_order_status(
        db,
        order_id,
        OrderStatus.paid,
        stripe_payment_intent="dev_mock_payment_intent",
    )
    enqueue_generation(order_id)

    return {
        "ok": True,
        "order_id": order_id,
        "tier": order.tier,
        "message": "Payment simulated, generation started",
    }


@router.get("/order/{order_id}", dependencies=[Depends(require_dev_token)])
async def dev_get_order(
    order_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Получить заказ без авторизации — для отладки."""
    order = await orders_service.get_order_by_id(db, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return {
        "id": order.id,
        "status": order.status,
        "topic": order.topic,
        "tier": order.tier,
        "output_filename": order.output_filename,
        "error_message": order.error_message,
    }
