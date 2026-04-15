"""Защита /dev/* X-Dev-Token'ом."""
import pytest


@pytest.mark.asyncio
async def test_dev_complete_without_token(client):
    r = await client.post("/dev/complete-payment/00000000-0000-0000-0000-000000000000", json={})
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_dev_complete_wrong_token(client):
    r = await client.post(
        "/dev/complete-payment/00000000-0000-0000-0000-000000000000",
        json={},
        headers={"X-Dev-Token": "wrong"},
    )
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_dev_complete_with_correct_token(client):
    # Токен корректен, но заказа нет → 404.
    r = await client.post(
        "/dev/complete-payment/00000000-0000-0000-0000-000000000000",
        json={},
        headers={"X-Dev-Token": "test_dev_token"},
    )
    assert r.status_code == 404
