import logging

from fastapi import APIRouter, Depends, HTTPException, Response, Request, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from config import settings
from models import User
from auth import service
from auth.dependencies import get_current_user
from auth.rate_limit import limit_login, limit_register

router = APIRouter(prefix="/auth", tags=["auth"])
log = logging.getLogger("zashitu.auth")


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: str
    email: str
    is_verified: bool

    class Config:
        from_attributes = True


def _set_auth_cookies(response: Response, tokens: dict):
    response.set_cookie(
        key="access_token",
        value=tokens["access_token"],
        httponly=True,
        samesite=settings.COOKIE_SAMESITE,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        secure=settings.COOKIE_SECURE,
    )
    response.set_cookie(
        key="refresh_token",
        value=tokens["refresh_token"],
        httponly=True,
        samesite=settings.COOKIE_SAMESITE,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 3600,
        secure=settings.COOKIE_SECURE,
    )


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(
    body: RegisterRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    limit_register(request)
    try:
        user = await service.register_user(db, body.email, body.password)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    log.info("user registered", extra={"event": "register", "user_id": user.id})
    return user


@router.post("/login")
async def login(
    body: LoginRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    limit_login(request)
    user = await service.authenticate_user(db, body.email, body.password)
    if not user:
        log.warning("login failed", extra={"event": "login_failed", "path": "/auth/login"})
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    tokens = service.create_tokens(user.id)
    _set_auth_cookies(response, tokens)
    log.info("login success", extra={"event": "login", "user_id": user.id})
    return {"user": UserResponse.model_validate(user)}


@router.post("/refresh")
async def refresh(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No refresh token")
    user_id = service.verify_refresh_token(token)
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
    user = await service.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    tokens = service.create_tokens(user.id)
    _set_auth_cookies(response, tokens)
    return {"ok": True}


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("access_token")
    response.delete_cookie("refresh_token")
    return {"ok": True}


@router.get("/me", response_model=UserResponse)
async def me(current_user: User = Depends(get_current_user)):
    return current_user
