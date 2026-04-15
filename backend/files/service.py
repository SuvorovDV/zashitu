import uuid
from sqlalchemy.ext.asyncio import AsyncSession

from models import UploadedFile
from files.repository import FilesRepository


async def get_file_by_order(db: AsyncSession, order_id: str):
    return await FilesRepository(db).get_by_order(order_id)


async def save_file_record(
    db: AsyncSession,
    order_id: str,
    original_filename: str,
    stored_filename: str,
    file_type: str,
    file_size: int,
) -> UploadedFile:
    repo = FilesRepository(db)
    existing = await repo.get_by_order(order_id)
    if existing:
        await repo.delete(existing)

    record = UploadedFile(
        id=str(uuid.uuid4()),
        order_id=order_id,
        original_filename=original_filename,
        stored_filename=stored_filename,
        file_type=file_type,
        file_size=file_size,
    )
    return await repo.add(record)
