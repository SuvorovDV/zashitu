from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import User, Order
from auth.dependencies import get_current_user
from orders import service

router = APIRouter(prefix="/orders", tags=["orders"])


class CreateOrderRequest(BaseModel):
    topic: str
    direction: Optional[str] = None
    work_type: Optional[str] = None
    duration_minutes: Optional[int] = None
    slides_count: Optional[int] = None
    detail_level: Optional[str] = None
    thesis: Optional[str] = None
    university: Optional[str] = None
    required_elements: Optional[list] = None
    custom_elements: Optional[str] = None
    mode: Optional[str] = None
    palette: Optional[str] = None
    tier: str = "basic"
    include_speech: bool = False
    presenter_name: Optional[str] = None
    presenter_role: Optional[str] = None
    skip_tech_details: bool = False
    speech_is_user_provided: bool = False
    user_speech_text: Optional[str] = None
    allow_enhance: bool = False


class OrderResponse(BaseModel):
    id: str
    user_id: str
    topic: str
    direction: Optional[str] = None
    work_type: Optional[str] = None
    duration_minutes: Optional[int] = None
    slides_count: Optional[int] = None
    detail_level: Optional[str] = None
    thesis: Optional[str] = None
    university: Optional[str] = None
    required_elements: Optional[str] = None
    mode: Optional[str] = None
    palette: Optional[str] = None
    tier: str
    status: str
    error_message: Optional[str] = None
    output_filename: Optional[str] = None
    stripe_session_id: Optional[str] = None
    include_speech: bool = False
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True

    @classmethod
    def from_orm_custom(cls, order: Order) -> "OrderResponse":
        return cls(
            id=order.id,
            user_id=order.user_id,
            topic=order.topic,
            direction=order.direction,
            work_type=order.work_type,
            duration_minutes=order.duration_minutes,
            slides_count=order.slides_count,
            detail_level=order.detail_level,
            thesis=order.thesis,
            university=order.university,
            required_elements=order.required_elements,
            mode=order.mode,
            palette=order.palette,
            tier=order.tier,
            status=order.status,
            error_message=order.error_message,
            output_filename=order.output_filename,
            stripe_session_id=order.stripe_session_id,
            include_speech=bool(order.include_speech),
            created_at=order.created_at.isoformat() if order.created_at else "",
            updated_at=order.updated_at.isoformat() if order.updated_at else "",
        )


@router.post("/", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
async def create_order(
    body: CreateOrderRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        order = await service.create_order(db, current_user.id, body.model_dump())
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return OrderResponse.from_orm_custom(order)


@router.get("/", response_model=List[OrderResponse])
async def list_orders(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    orders = await service.get_user_orders(db, current_user.id)
    return [OrderResponse.from_orm_custom(o) for o in orders]


@router.get("/{order_id}", response_model=OrderResponse)
async def get_order(
    order_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    order = await service.get_order(db, order_id, current_user.id)
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    return OrderResponse.from_orm_custom(order)


class UpdateTierRequest(BaseModel):
    tier: str


class UpdateNotesRequest(BaseModel):
    custom_elements: Optional[str] = None


@router.patch("/{order_id}/notes", response_model=OrderResponse)
async def update_order_notes(
    order_id: str,
    body: UpdateNotesRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Позволяет отредактировать custom_elements на Payment. Только до оплаты."""
    from models import OrderStatus as _OS
    order = await service.get_order(db, order_id, current_user.id)
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    if order.status != _OS.pending.value:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot edit after payment")
    order.custom_elements = (body.custom_elements or "").strip()[:4000] or None
    await db.commit()
    await db.refresh(order)
    return OrderResponse.from_orm_custom(order)


@router.patch("/{order_id}/tier", response_model=OrderResponse)
async def update_order_tier(
    order_id: str,
    body: UpdateTierRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from config import TIERS
    if body.tier not in TIERS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid tier")
    try:
        order = await service.update_order_tier(db, order_id, current_user.id, body.tier)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    return OrderResponse.from_orm_custom(order)


@router.delete("/{order_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_order(
    order_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    deleted = await service.delete_order(db, order_id, current_user.id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
