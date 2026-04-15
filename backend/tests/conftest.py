import os
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-tests-only")
# Тесты гоняются через HTTP без TLS — cookies должны выставляться, значит DEV_MODE
# и COOKIE_SECURE=False. Это же снимает требование STRIPE_SECRET_KEY.
os.environ.setdefault("DEV_MODE", "True")
os.environ.setdefault("COOKIE_SECURE", "False")
os.environ.setdefault("DEV_TOKEN", "test_dev_token")

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy.pool import StaticPool
from httpx import AsyncClient, ASGITransport

from database import Base, get_db
from main import app
from auth.rate_limit import login_limiter, register_limiter


@pytest.fixture(autouse=True)
def _reset_rate_limiters():
    """Каждый тест начинает с чистыми bucket'ами — иначе порядок тестов ломает 429."""
    login_limiter._buckets.clear()
    register_limiter._buckets.clear()
    yield

TEST_DB_URL = "sqlite+aiosqlite:///:memory:"


@pytest_asyncio.fixture
async def db():
    """Свежая in-memory SQLite база для каждого теста."""
    engine = create_async_engine(
        TEST_DB_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        echo=False,
    )
    async with engine.begin() as conn:
        from models import User, Order, UploadedFile  # noqa: F401
        await conn.run_sync(Base.metadata.create_all)

    SessionLocal = async_sessionmaker(engine, expire_on_commit=False)
    async with SessionLocal() as session:
        yield session

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture
async def client(db):
    """HTTP-клиент с переопределённой зависимостью БД."""
    async def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def auth_client(client):
    """HTTP-клиент с уже выполненным логином."""
    await client.post("/auth/register", json={"email": "auth@test.com", "password": "testpass123"})
    await client.post("/auth/login", json={"email": "auth@test.com", "password": "testpass123"})
    return client
