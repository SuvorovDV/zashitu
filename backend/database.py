from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from config import settings


engine = create_async_engine(settings.DATABASE_URL, echo=False)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


async def get_db():
    """Предоставляет сессию запросу; коммит — явный в сервисе, rollback при исключении."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def create_tables():
    """
    Dev-фоллбэк: создаёт все таблицы через metadata.create_all.
    Продакшн запускает Alembic миграции — `alembic upgrade head`.
    """
    async with engine.begin() as conn:
        from models import User, Order, UploadedFile  # noqa: F401
        await conn.run_sync(Base.metadata.create_all)
