"""Повторный webhook checkout.session.completed не запускает вторую генерацию."""
from unittest.mock import patch, MagicMock
import pytest

from models import OrderStatus


@pytest.mark.asyncio
async def test_repeated_webhook_is_noop(auth_client):
    # Создаём заказ.
    r = await auth_client.post("/orders/", json={"topic": "webhook test"})
    assert r.status_code == 201
    order_id = r.json()["id"]

    event = {
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "metadata": {"order_id": order_id},
                "payment_intent": "pi_test_123",
            }
        },
    }

    enqueue_calls = []

    def fake_enqueue(oid):
        enqueue_calls.append(oid)

    with patch("payments.router.stripe.Webhook.construct_event", return_value=event), \
         patch("payments.router.enqueue_generation", side_effect=fake_enqueue):
        # Первый webhook → перевод в paid + enqueue.
        r1 = await auth_client.post("/payments/webhook", content=b"{}", headers={"stripe-signature": "t=1"})
        assert r1.status_code == 200
        assert len(enqueue_calls) == 1

        # Повторный тот же webhook → уже не pending, enqueue не должен быть вызван повторно.
        r2 = await auth_client.post("/payments/webhook", content=b"{}", headers={"stripe-signature": "t=1"})
        assert r2.status_code == 200
        assert len(enqueue_calls) == 1
