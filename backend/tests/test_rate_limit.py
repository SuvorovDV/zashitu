"""Проверяем что auth/rate_limit.py реально лимитит попытки входа.

Сброс bucket'ов между тестами — в conftest (autouse).
"""
import pytest


@pytest.mark.asyncio
async def test_login_limiter_blocks_after_10_attempts(client):
    # 10 неверных попыток — 401; 11-я — 429 с Retry-After.
    for _ in range(10):
        r = await client.post("/auth/login", json={"email": "nobody@test.com", "password": "x"})
        assert r.status_code == 401

    r = await client.post("/auth/login", json={"email": "nobody@test.com", "password": "x"})
    assert r.status_code == 429
    assert "retry-after" in {k.lower() for k in r.headers.keys()}


@pytest.mark.asyncio
async def test_register_limiter_blocks_after_5(client):
    for i in range(5):
        r = await client.post("/auth/register", json={"email": f"u{i}@t.com", "password": "pass1234"})
        assert r.status_code in (201, 409)

    r = await client.post("/auth/register", json={"email": "u5@t.com", "password": "pass1234"})
    assert r.status_code == 429
