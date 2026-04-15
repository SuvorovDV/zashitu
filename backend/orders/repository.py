"""Repository для модуля orders."""
from typing import Optional

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from models import Order


class OrdersRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, order_id: str) -> Optional[Order]:
        result = await self.db.execute(select(Order).where(Order.id == order_id))
        return result.scalar_one_or_none()

    async def get_for_user(self, order_id: str, user_id: str) -> Optional[Order]:
        result = await self.db.execute(
            select(Order).where(Order.id == order_id, Order.user_id == user_id)
        )
        return result.scalar_one_or_none()

    async def list_for_user(self, user_id: str) -> list[Order]:
        result = await self.db.execute(
            select(Order).where(Order.user_id == user_id).order_by(Order.created_at.desc())
        )
        return list(result.scalars().all())

    async def add(self, order: Order) -> Order:
        self.db.add(order)
        await self.db.commit()
        await self.db.refresh(order)
        return order

    async def commit_refresh(self, order: Order) -> Order:
        await self.db.commit()
        await self.db.refresh(order)
        return order

    async def delete_for_user(self, order_id: str, user_id: str) -> bool:
        result = await self.db.execute(
            delete(Order).where(Order.id == order_id, Order.user_id == user_id)
        )
        await self.db.commit()
        return result.rowcount > 0
