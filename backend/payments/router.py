import stripe
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings, TIERS, COST_ESTIMATE_RUB, TIER_ORDER
from database import get_db
from models import User, OrderStatus
from auth.dependencies import get_current_user
from orders import service as orders_service
from generation.service import enqueue_generation
from payments import service as payments_service

router = APIRouter(prefix="/payments", tags=["payments"])


@router.get("/tiers")
async def get_tiers():
    # Отдаём в том же порядке что TIER_ORDER (basic → premium).
    return {
        tier_id: {
            "id": tier_id,
            "order": TIER_ORDER.index(tier_id),
            "label": TIERS[tier_id]["label"],
            "price_usd": TIERS[tier_id]["price_cents"] / 100,
            "price_rub": TIERS[tier_id]["price_rub"],
            "slides": TIERS[tier_id]["slides"],
            "max_slides": TIERS[tier_id]["max_slides"],
            "max_duration_minutes": TIERS[tier_id]["max_duration_minutes"],
            "model": TIERS[tier_id]["model"],
            "cost_estimate_rub": COST_ESTIMATE_RUB.get(tier_id, {"slides_only": 0, "with_speech": 0}),
        }
        for tier_id in TIER_ORDER
    }


class CreateSessionRequest(BaseModel):
    order_id: str


@router.post("/create-session")
async def create_session(
    body: CreateSessionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    order = await orders_service.get_order(db, body.order_id, current_user.id)
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    if order.status != OrderStatus.pending.value:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Order is not in pending status")
    if order.tier not in TIERS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid tier")

    try:
        checkout_url, session_id = payments_service.create_checkout_session(
            order_id=order.id,
            tier=order.tier,
            user_email=current_user.email,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Stripe недоступен: {e}. В dev-режиме используй кнопку 'Симулировать оплату'.",
        )
    await orders_service.update_order_status(
        db, order.id, OrderStatus.pending, stripe_session_id=session_id
    )
    return {"checkout_url": checkout_url}


class InternalConfirmRequest(BaseModel):
    order_id: str


@router.post("/internal/confirm")
async def internal_confirm_payment(
    body: InternalConfirmRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Подтверждение оплаты, выполненной вне Stripe (Telegram Stars из бота).

    Требует X-Bot-Secret. Идемпотентно: повторный вызов — no-op.
    """
    secret = request.headers.get("X-Bot-Secret")
    if not settings.BOT_INTERNAL_SECRET or secret != settings.BOT_INTERNAL_SECRET:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid bot secret")

    order = await orders_service.get_order_by_id(db, body.order_id)
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    if order.status != OrderStatus.pending.value:
        return {"ok": True, "already_processed": True, "status": order.status}

    await orders_service.update_order_status(db, body.order_id, OrderStatus.paid)
    enqueue_generation(body.order_id)
    return {"ok": True, "status": OrderStatus.paid.value}


@router.post("/webhook")
async def stripe_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
        )
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid signature")
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid payload")

    if event["type"] == "checkout.session.completed":
        session = (event.get("data") or {}).get("object") or {}
        order_id = (session.get("metadata") or {}).get("order_id")
        payment_intent = session.get("payment_intent")

        if order_id:
            order = await orders_service.get_order_by_id(db, order_id)
            if order:
                # Идемпотентность: Stripe может повторить webhook.
                # Принимаем переход только из pending. Повторный payment_intent
                # или уже продвинутый статус → no-op.
                already_processed = (
                    order.status != OrderStatus.pending.value
                    or (order.stripe_payment_intent and order.stripe_payment_intent == payment_intent)
                )
                if not already_processed:
                    await orders_service.update_order_status(
                        db,
                        order_id,
                        OrderStatus.paid,
                        stripe_payment_intent=payment_intent,
                    )
                    enqueue_generation(order_id)

    return {"ok": True}
