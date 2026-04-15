import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
from jose import jwt, JWTError
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from models import User
from auth.repository import AuthRepository

ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def _create_token(data: dict, expire_delta: timedelta) -> str:
    payload = data.copy()
    payload["exp"] = datetime.now(timezone.utc) + expire_delta
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGORITHM)


def create_tokens(user_id: str) -> dict:
    access_token = _create_token(
        {"sub": user_id, "type": "access"},
        timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    refresh_token = _create_token(
        {"sub": user_id, "type": "refresh"},
        timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )
    return {"access_token": access_token, "refresh_token": refresh_token}


def _decode_token(token: str, token_type: str) -> Optional[str]:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != token_type:
            return None
        return payload.get("sub")
    except JWTError:
        return None


def verify_access_token(token: str) -> Optional[str]:
    return _decode_token(token, "access")


def verify_refresh_token(token: str) -> Optional[str]:
    return _decode_token(token, "refresh")


async def get_user_by_id(db: AsyncSession, user_id: str) -> Optional[User]:
    return await AuthRepository(db).get_by_id(user_id)


async def get_user_by_email(db: AsyncSession, email: str) -> Optional[User]:
    return await AuthRepository(db).get_by_email(email)


async def register_user(db: AsyncSession, email: str, password: str) -> User:
    repo = AuthRepository(db)
    existing = await repo.get_by_email(email)
    if existing:
        raise ValueError("Email already registered")
    user = User(
        id=str(uuid.uuid4()),
        email=email,
        hashed_password=hash_password(password),
    )
    return await repo.add(user)


async def authenticate_user(db: AsyncSession, email: str, password: str) -> Optional[User]:
    user = await AuthRepository(db).get_by_email(email)
    if not user or not user.hashed_password:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user
