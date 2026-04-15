"""Тесты для orders/service.py и /orders/* эндпоинтов."""
import pytest
from auth.service import register_user
from orders.service import (
    create_order,
    get_order,
    get_order_by_id,
    get_user_orders,
    update_order_status,
    delete_order,
)
from models import OrderStatus


# ── create_order ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_order_minimal(db):
    user = await register_user(db, "co@test.com", "pass")
    order = await create_order(db, user.id, {"topic": "Тестовая тема", "tier": "basic"})
    assert order.id is not None
    assert order.topic == "Тестовая тема"
    assert order.tier == "basic"
    assert order.status == OrderStatus.pending


@pytest.mark.asyncio
async def test_create_order_full(db):
    user = await register_user(db, "cf@test.com", "pass")
    order = await create_order(db, user.id, {
        "topic": "Диплом по ML",
        "direction": "Информатика",
        "work_type": "ВКР",
        "duration_minutes": 15,
        "detail_level": "Подробный",
        "thesis": "Нейросети рулят",
        "university": "МГУ",
        "required_elements": ["Введение", "Выводы"],
        "mode": "source_grounded",
        "palette": "midnight_executive",
        "tier": "premium",
    })
    assert order.direction == "Информатика"
    assert order.work_type == "ВКР"
    assert order.tier == "premium"
    assert "Введение" in order.required_elements  # хранится как JSON строка


@pytest.mark.asyncio
async def test_create_order_default_tier(db):
    user = await register_user(db, "dt@test.com", "pass")
    order = await create_order(db, user.id, {"topic": "Тема"})
    assert order.tier == "basic"


# ── get_order / get_order_by_id ───────────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_order_owner(db):
    user = await register_user(db, "go@test.com", "pass")
    order = await create_order(db, user.id, {"topic": "Тема"})
    found = await get_order(db, order.id, user.id)
    assert found is not None
    assert found.id == order.id


@pytest.mark.asyncio
async def test_get_order_wrong_owner_returns_none(db):
    user = await register_user(db, "own@test.com", "pass")
    other = await register_user(db, "other@test.com", "pass")
    order = await create_order(db, user.id, {"topic": "Тема"})
    found = await get_order(db, order.id, other.id)
    assert found is None


@pytest.mark.asyncio
async def test_get_order_by_id_no_owner_check(db):
    user = await register_user(db, "goid@test.com", "pass")
    order = await create_order(db, user.id, {"topic": "Тема"})
    found = await get_order_by_id(db, order.id)
    assert found is not None
    assert found.id == order.id


@pytest.mark.asyncio
async def test_get_order_by_id_not_found(db):
    found = await get_order_by_id(db, "non-existent-id")
    assert found is None


# ── get_user_orders ───────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_user_orders_empty(db):
    user = await register_user(db, "empty@test.com", "pass")
    orders = await get_user_orders(db, user.id)
    assert orders == []


@pytest.mark.asyncio
async def test_get_user_orders_multiple(db):
    user = await register_user(db, "list@test.com", "pass")
    await create_order(db, user.id, {"topic": "Заказ 1"})
    await create_order(db, user.id, {"topic": "Заказ 2"})
    await create_order(db, user.id, {"topic": "Заказ 3"})
    orders = await get_user_orders(db, user.id)
    assert len(orders) == 3


@pytest.mark.asyncio
async def test_get_user_orders_only_own(db):
    user1 = await register_user(db, "u1@test.com", "pass")
    user2 = await register_user(db, "u2@test.com", "pass")
    await create_order(db, user1.id, {"topic": "Заказ u1"})
    await create_order(db, user2.id, {"topic": "Заказ u2"})
    orders = await get_user_orders(db, user1.id)
    assert len(orders) == 1
    assert orders[0].topic == "Заказ u1"


# ── update_order_status ───────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_update_order_status_paid(db):
    user = await register_user(db, "upd@test.com", "pass")
    order = await create_order(db, user.id, {"topic": "Тема"})
    updated = await update_order_status(db, order.id, OrderStatus.paid)
    assert updated.status == OrderStatus.paid


@pytest.mark.asyncio
async def test_update_order_status_with_kwargs(db):
    user = await register_user(db, "ukw@test.com", "pass")
    order = await create_order(db, user.id, {"topic": "Тема"})
    updated = await update_order_status(
        db, order.id, OrderStatus.done,
        output_filename="abc123.pptx"
    )
    assert updated.status == OrderStatus.done
    assert updated.output_filename == "abc123.pptx"


@pytest.mark.asyncio
async def test_update_order_status_not_found(db):
    result = await update_order_status(db, "non-existent", OrderStatus.failed)
    assert result is None


# ── delete_order ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_delete_order_success(db):
    user = await register_user(db, "del@test.com", "pass")
    order = await create_order(db, user.id, {"topic": "Тема"})
    result = await delete_order(db, order.id, user.id)
    assert result is True
    assert await get_order(db, order.id, user.id) is None


@pytest.mark.asyncio
async def test_delete_order_wrong_owner(db):
    user = await register_user(db, "dow@test.com", "pass")
    other = await register_user(db, "dow2@test.com", "pass")
    order = await create_order(db, user.id, {"topic": "Тема"})
    result = await delete_order(db, order.id, other.id)
    assert result is False


@pytest.mark.asyncio
async def test_delete_order_not_found(db):
    user = await register_user(db, "dnf@test.com", "pass")
    result = await delete_order(db, "non-existent", user.id)
    assert result is False


# ── HTTP-эндпоинты /orders/* ──────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_orders_create_unauthenticated(client):
    resp = await client.post("/orders/", json={"topic": "Тема", "tier": "basic"})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_orders_create_authenticated(auth_client):
    resp = await auth_client.post("/orders/", json={"topic": "Моя работа", "tier": "standard"})
    assert resp.status_code == 201
    data = resp.json()
    assert data["topic"] == "Моя работа"
    assert data["tier"] == "standard"
    assert data["status"] == "pending"


@pytest.mark.asyncio
async def test_orders_list(auth_client):
    await auth_client.post("/orders/", json={"topic": "Заказ 1", "tier": "basic"})
    await auth_client.post("/orders/", json={"topic": "Заказ 2", "tier": "premium"})
    resp = await auth_client.get("/orders/")
    assert resp.status_code == 200
    assert len(resp.json()) == 2


@pytest.mark.asyncio
async def test_orders_get_single(auth_client):
    create_resp = await auth_client.post("/orders/", json={"topic": "Один", "tier": "basic"})
    order_id = create_resp.json()["id"]
    resp = await auth_client.get(f"/orders/{order_id}")
    assert resp.status_code == 200
    assert resp.json()["id"] == order_id


@pytest.mark.asyncio
async def test_orders_get_not_found(auth_client):
    resp = await auth_client.get("/orders/non-existent-id")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_orders_delete(auth_client):
    create_resp = await auth_client.post("/orders/", json={"topic": "Удалить", "tier": "basic"})
    order_id = create_resp.json()["id"]
    del_resp = await auth_client.delete(f"/orders/{order_id}")
    assert del_resp.status_code == 204
    resp = await auth_client.get(f"/orders/{order_id}")
    assert resp.status_code == 404
