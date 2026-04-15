"""Интеграционные тесты HTTP-эндпоинтов /auth/*."""
import pytest


# ── Регистрация ───────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_register_success(client):
    resp = await client.post("/auth/register", json={"email": "reg@test.com", "password": "pass123"})
    assert resp.status_code == 201
    data = resp.json()
    assert data["email"] == "reg@test.com"
    assert "id" in data
    assert "hashed_password" not in data  # не утекаем


@pytest.mark.asyncio
async def test_register_invalid_email(client):
    resp = await client.post("/auth/register", json={"email": "notanemail", "password": "pass"})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_register_duplicate_email(client):
    await client.post("/auth/register", json={"email": "dup@test.com", "password": "pass"})
    resp = await client.post("/auth/register", json={"email": "dup@test.com", "password": "pass2"})
    assert resp.status_code == 409


# ── Вход ─────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_login_sets_cookies(client):
    await client.post("/auth/register", json={"email": "login@test.com", "password": "pass123"})
    resp = await client.post("/auth/login", json={"email": "login@test.com", "password": "pass123"})
    assert resp.status_code == 200
    assert "access_token" in resp.cookies
    assert "refresh_token" in resp.cookies


@pytest.mark.asyncio
async def test_login_returns_user(client):
    await client.post("/auth/register", json={"email": "ret@test.com", "password": "pass123"})
    resp = await client.post("/auth/login", json={"email": "ret@test.com", "password": "pass123"})
    data = resp.json()
    assert "user" in data
    assert data["user"]["email"] == "ret@test.com"


@pytest.mark.asyncio
async def test_login_wrong_password(client):
    await client.post("/auth/register", json={"email": "wpass@test.com", "password": "correct"})
    resp = await client.post("/auth/login", json={"email": "wpass@test.com", "password": "wrong"})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_login_unknown_email(client):
    resp = await client.post("/auth/login", json={"email": "nobody@test.com", "password": "pass"})
    assert resp.status_code == 401


# ── /auth/me ─────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_me_unauthenticated(client):
    resp = await client.get("/auth/me")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_me_authenticated(auth_client):
    resp = await auth_client.get("/auth/me")
    assert resp.status_code == 200
    assert resp.json()["email"] == "auth@test.com"


# ── Выход ─────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_logout_clears_cookies(auth_client):
    resp = await auth_client.post("/auth/logout")
    assert resp.status_code == 200
    # После логаута /me должен вернуть 401
    resp2 = await auth_client.get("/auth/me")
    assert resp2.status_code == 401


# ── Refresh ───────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_refresh_without_token(client):
    resp = await client.post("/auth/refresh")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_refresh_with_valid_token(auth_client):
    resp = await auth_client.post("/auth/refresh")
    assert resp.status_code == 200
    assert "access_token" in resp.cookies


# ── Health ────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_health(client):
    resp = await client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert "dev_mode" in body
