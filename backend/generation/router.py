import json
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import User, OrderStatus
from auth.dependencies import get_current_user
from orders import service as orders_service

router = APIRouter(prefix="/generation", tags=["generation"])
log = logging.getLogger("zashitu.generation")


class RevisionNoteBody(BaseModel):
    note: Optional[str] = None

# Лимиты approval-итераций.
MAX_SPEECH_REVISIONS = 10
MAX_SLIDES_REVISIONS = 5


def _slide_plan_from_prompt(prompt_text: str | None):
    if not prompt_text:
        return None
    try:
        data = json.loads(prompt_text)
    except Exception as e:
        log.warning("invalid generation_prompt JSON: %s", e)
        return None
    return data.get("slide_plan")


@router.get("/status/{order_id}")
async def get_status(
    order_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    order = await orders_service.get_order(db, order_id, current_user.id)
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

    prompt_data = None
    slide_plan = None
    if order.generation_prompt:
        try:
            prompt_data = json.loads(order.generation_prompt)
            slide_plan = prompt_data.get("slide_plan") if isinstance(prompt_data, dict) else None
        except Exception as e:
            log.warning("invalid generation_prompt JSON for order %s: %s", order.id, e)

    speech_prompt_data = None
    if order.speech_prompt:
        try:
            speech_prompt_data = json.loads(order.speech_prompt)
        except Exception as e:
            log.warning("invalid speech_prompt JSON for order %s: %s", order.id, e)

    return {
        "order_id": order.id,
        "status": order.status,
        "output_filename": order.output_filename,
        "error_message": order.error_message,
        "generation_prompt": prompt_data,
        "speech_prompt": speech_prompt_data,
        "slide_plan": slide_plan,
        "include_speech": bool(order.include_speech),
        "speech_text": order.speech_text,
        "speech_approved": bool(order.speech_approved),
        "slides_approved": bool(order.slides_approved),
        "speech_revisions": int(order.speech_revisions),
        "slides_revisions": int(order.slides_revisions),
        "max_speech_revisions": MAX_SPEECH_REVISIONS,
        "max_slides_revisions": MAX_SLIDES_REVISIONS,
        "preview_count": int(order.preview_count or 0),
    }


def _require_paid(order):
    """Approval-эндпоинты работают только над оплаченным заказом."""
    if order.status == OrderStatus.pending.value:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Order is not paid yet")
    if order.status == OrderStatus.failed.value:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Order has failed; create a new one")


@router.post("/{order_id}/speech/regenerate")
async def regenerate_speech(
    order_id: str,
    body: RevisionNoteBody = RevisionNoteBody(),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    order = await orders_service.get_order(db, order_id, current_user.id)
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    if not order.include_speech:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This order has no speech stage")
    _require_paid(order)
    if order.speech_approved:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Speech is already approved")
    if order.speech_revisions >= MAX_SPEECH_REVISIONS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Speech revision limit reached")

    order.speech_revisions += 1
    order.speech_text = None
    order.speech_revision_note = (body.note or "").strip()[:2000] or None
    order.status = OrderStatus.generating.value
    await db.commit()

    from generation.tasks import generate_speech_task
    generate_speech_task.delay(order.id)
    return {"ok": True, "speech_revisions": order.speech_revisions, "max": MAX_SPEECH_REVISIONS}


@router.post("/{order_id}/speech/approve")
async def approve_speech(
    order_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    order = await orders_service.get_order(db, order_id, current_user.id)
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    if not order.include_speech:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This order has no speech stage")
    _require_paid(order)
    if order.speech_approved:
        return {"ok": True, "already_approved": True}
    if not order.speech_text:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Speech not ready yet")

    order.speech_approved = True
    order.status = OrderStatus.generating.value
    await db.commit()

    from generation.tasks import generate_slides_task
    generate_slides_task.delay(order.id)
    return {"ok": True}


@router.post("/{order_id}/slides/regenerate")
async def regenerate_slides(
    order_id: str,
    body: RevisionNoteBody = RevisionNoteBody(),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    order = await orders_service.get_order(db, order_id, current_user.id)
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    if not order.include_speech:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Auto-approved order — no revisions")
    if not order.speech_approved:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Approve the speech first")
    _require_paid(order)
    if order.slides_approved:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Slides are already approved")
    if order.slides_revisions >= MAX_SLIDES_REVISIONS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Slides revision limit reached")

    order.slides_revisions += 1
    order.output_filename = None
    order.generation_prompt = None
    order.preview_count = 0
    order.slides_revision_note = (body.note or "").strip()[:2000] or None
    order.status = OrderStatus.generating.value
    await db.commit()

    from generation.tasks import generate_slides_task
    generate_slides_task.delay(order.id)
    return {"ok": True, "slides_revisions": order.slides_revisions, "max": MAX_SLIDES_REVISIONS}


@router.post("/{order_id}/slides/approve")
async def approve_slides(
    order_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    order = await orders_service.get_order(db, order_id, current_user.id)
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    _require_paid(order)
    if not order.output_filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Slides not ready yet")

    order.slides_approved = True
    order.status = OrderStatus.done.value
    await db.commit()
    return {"ok": True}
