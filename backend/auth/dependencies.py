import uuid

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from database import get_db
from models import User
from auth.repository import AuthRepository
from auth.service import verify_access_token, get_user_by_id


async def _get_or_create_bot_user(db: AsyncSession) -> User:
    repo = AuthRepository(db)
    user = await repo.get_by_email(settings.BOT_SERVICE_USER_EMAIL)
    if user:
        return user
    user = User(
        id=str(uuid.uuid4()),
        email=settings.BOT_SERVICE_USER_EMAIL,
        hashed_password=None,
        is_verified=True,
    )
    return await repo.add(user)


async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> User:
    bot_secret = request.headers.get("X-Bot-Secret")
    if bot_secret and settings.BOT_INTERNAL_SECRET and bot_secret == settings.BOT_INTERNAL_SECRET:
        return await _get_or_create_bot_user(db)

    token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    user_id = verify_access_token(token)
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

    user = await get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    return user
