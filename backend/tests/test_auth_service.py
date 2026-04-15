"""Юнит-тесты для auth/service.py — без HTTP и без реальной БД."""
import pytest
from auth.service import (
    hash_password,
    verify_password,
    create_tokens,
    verify_access_token,
    verify_refresh_token,
    register_user,
    authenticate_user,
    get_user_by_email,
    get_user_by_id,
)


# ── Хеширование паролей ──────────────────────────────────────────────────────

def test_hash_password_is_not_plaintext():
    hashed = hash_password("mypassword")
    assert hashed != "mypassword"


def test_hash_password_bcrypt_format():
    hashed = hash_password("mypassword")
    assert hashed.startswith("$2b$")


def test_verify_password_correct():
    hashed = hash_password("correct")
    assert verify_password("correct", hashed) is True


def test_verify_password_wrong():
    hashed = hash_password("correct")
    assert verify_password("wrong", hashed) is False


def test_same_password_different_hashes():
    h1 = hash_password("pass")
    h2 = hash_password("pass")
    assert h1 != h2  # bcrypt salt уникален


# ── JWT-токены ────────────────────────────────────────────────────────────────

def test_create_tokens_returns_both():
    tokens = create_tokens("user-123")
    assert "access_token" in tokens
    assert "refresh_token" in tokens


def test_access_and_refresh_tokens_differ():
    tokens = create_tokens("user-123")
    assert tokens["access_token"] != tokens["refresh_token"]


def test_verify_access_token_valid():
    tokens = create_tokens("user-abc")
    assert verify_access_token(tokens["access_token"]) == "user-abc"


def test_verify_refresh_token_valid():
    tokens = create_tokens("user-xyz")
    assert verify_refresh_token(tokens["refresh_token"]) == "user-xyz"


def test_access_token_rejected_as_refresh():
    tokens = create_tokens("user-abc")
    assert verify_refresh_token(tokens["access_token"]) is None


def test_refresh_token_rejected_as_access():
    tokens = create_tokens("user-abc")
    assert verify_access_token(tokens["refresh_token"]) is None


def test_invalid_token_returns_none():
    assert verify_access_token("not.a.valid.token") is None
    assert verify_refresh_token("not.a.valid.token") is None


def test_empty_token_returns_none():
    assert verify_access_token("") is None


# ── Регистрация и аутентификация (с БД) ──────────────────────────────────────

@pytest.mark.asyncio
async def test_register_user_creates_record(db):
    user = await register_user(db, "new@example.com", "pass")
    assert user.id is not None
    assert user.email == "new@example.com"
    assert user.hashed_password != "pass"
    assert user.is_verified is True


@pytest.mark.asyncio
async def test_register_duplicate_raises(db):
    await register_user(db, "dup@example.com", "pass")
    with pytest.raises(ValueError, match="already registered"):
        await register_user(db, "dup@example.com", "pass2")


@pytest.mark.asyncio
async def test_authenticate_user_success(db):
    await register_user(db, "auth@example.com", "correctpass")
    user = await authenticate_user(db, "auth@example.com", "correctpass")
    assert user is not None
    assert user.email == "auth@example.com"


@pytest.mark.asyncio
async def test_authenticate_user_wrong_password(db):
    await register_user(db, "wp@example.com", "correct")
    result = await authenticate_user(db, "wp@example.com", "wrong")
    assert result is None


@pytest.mark.asyncio
async def test_authenticate_user_not_found(db):
    result = await authenticate_user(db, "nobody@example.com", "pass")
    assert result is None


@pytest.mark.asyncio
async def test_get_user_by_email(db):
    user = await register_user(db, "byemail@example.com", "pass")
    found = await get_user_by_email(db, "byemail@example.com")
    assert found is not None
    assert found.id == user.id


@pytest.mark.asyncio
async def test_get_user_by_email_not_found(db):
    result = await get_user_by_email(db, "missing@example.com")
    assert result is None


@pytest.mark.asyncio
async def test_get_user_by_id(db):
    user = await register_user(db, "byid@example.com", "pass")
    found = await get_user_by_id(db, user.id)
    assert found is not None
    assert found.email == "byid@example.com"
