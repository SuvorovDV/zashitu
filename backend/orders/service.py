import uuid
import json
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession

from config import TIERS
from models import Order, OrderStatus
from orders.repository import OrdersRepository


def _validate_against_tier(
    tier_id: str, slides_count, duration_minutes, detail_level=None, work_type=None,
) -> None:
    """Проверяем, что запрошенный объём помещается в лимиты тарифа."""
    cfg = TIERS.get(tier_id)
    if not cfg:
        raise ValueError("Unknown tier")
    if slides_count and int(slides_count) > cfg["max_slides"]:
        raise ValueError(
            f"Тариф «{cfg['label']}» поддерживает до {cfg['max_slides']} слайдов; "
            f"выбран {slides_count}"
        )
    if duration_minutes and int(duration_minutes) > cfg["max_duration_minutes"]:
        raise ValueError(
            f"Тариф «{cfg['label']}» поддерживает до {cfg['max_duration_minutes']} мин; "
            f"выбрано {duration_minutes}"
        )
    # Подробный уровень детализации доступен только для Премиума.
    if detail_level == "detailed" and tier_id != "premium":
        raise ValueError("Уровень «Подробный» доступен только для тарифа «Премиум»")
    # Премиум-тариф (Opus 4.7, 30 слайдов, 45 мин) не имеет смысла для школьного реферата:
    # стандартного объёма хватает с запасом, дороже модель — overkill для школы.
    if (work_type or "").strip() == "Школьный реферат" and tier_id == "premium":
        raise ValueError(
            "Тариф «Премиум» не доступен для школьного реферата — выберите Базовый или Стандарт"
        )


async def create_order(db: AsyncSession, user_id: str, data: dict) -> Order:
    required_elements = data.get("required_elements")
    if isinstance(required_elements, list):
        required_elements = json.dumps(required_elements, ensure_ascii=False)

    tier = data.get("tier", "basic")
    _validate_against_tier(
        tier,
        data.get("slides_count"),
        data.get("duration_minutes"),
        data.get("detail_level"),
        data.get("work_type"),
    )

    order = Order(
        id=str(uuid.uuid4()),
        user_id=user_id,
        topic=data["topic"],
        direction=data.get("direction"),
        work_type=data.get("work_type"),
        duration_minutes=data.get("duration_minutes"),
        slides_count=data.get("slides_count"),
        detail_level=data.get("detail_level"),
        thesis=data.get("thesis"),
        university=data.get("university"),
        required_elements=required_elements,
        custom_elements=(data.get("custom_elements") or None),
        mode=data.get("mode"),
        palette=data.get("palette"),
        tier=data.get("tier", "basic"),
        include_speech=bool(data.get("include_speech", False)),
        presenter_name=(data.get("presenter_name") or None),
        presenter_role=(data.get("presenter_role") or None),
        skip_tech_details=bool(data.get("skip_tech_details", False)),
        speech_is_user_provided=bool(data.get("speech_is_user_provided", False)),
        user_speech_text=((data.get("user_speech_text") or "")[:40000] or None),
        allow_enhance=bool(data.get("allow_enhance", False)),
        status=OrderStatus.pending.value,
    )
    return await OrdersRepository(db).add(order)


async def get_order(db: AsyncSession, order_id: str, user_id: str) -> Optional[Order]:
    return await OrdersRepository(db).get_for_user(order_id, user_id)


async def get_order_by_id(db: AsyncSession, order_id: str) -> Optional[Order]:
    return await OrdersRepository(db).get_by_id(order_id)


async def get_user_orders(db: AsyncSession, user_id: str) -> list[Order]:
    return await OrdersRepository(db).list_for_user(user_id)


async def update_order_status(db: AsyncSession, order_id: str, status, **kwargs) -> Optional[Order]:
    repo = OrdersRepository(db)
    order = await repo.get_by_id(order_id)
    if not order:
        return None
    order.status = status.value if isinstance(status, OrderStatus) else status
    for key, value in kwargs.items():
        setattr(order, key, value)
    return await repo.commit_refresh(order)


async def update_order_tier(db: AsyncSession, order_id: str, user_id: str, tier: str) -> Optional[Order]:
    """Меняет тариф только у pending-заказа. Возвращает None если не найден или уже оплачен."""
    repo = OrdersRepository(db)
    order = await repo.get_for_user(order_id, user_id)
    if not order:
        return None
    if order.status != OrderStatus.pending.value:
        raise ValueError("Cannot change tier after payment")
    _validate_against_tier(tier, order.slides_count, order.duration_minutes, order.detail_level, order.work_type)
    order.tier = tier
    return await repo.commit_refresh(order)


async def delete_order(db: AsyncSession, order_id: str, user_id: str) -> bool:
    return await OrdersRepository(db).delete_for_user(order_id, user_id)
