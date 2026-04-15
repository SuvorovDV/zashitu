"""Repository для модуля files."""
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models import UploadedFile


class FilesRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_order(self, order_id: str) -> Optional[UploadedFile]:
        result = await self.db.execute(
            select(UploadedFile).where(UploadedFile.order_id == order_id)
        )
        return result.scalar_one_or_none()

    async def delete(self, record: UploadedFile) -> None:
        await self.db.delete(record)
        await self.db.commit()

    async def add(self, record: UploadedFile) -> UploadedFile:
        self.db.add(record)
        await self.db.commit()
        await self.db.refresh(record)
        return record
