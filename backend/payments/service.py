import stripe
from config import settings, TIERS

if settings.STRIPE_SECRET_KEY:
    stripe.api_key = settings.STRIPE_SECRET_KEY


def create_checkout_session(order_id: str, tier: str, user_email: str) -> str:
    if not settings.STRIPE_SECRET_KEY:
        raise RuntimeError("STRIPE_SECRET_KEY не сконфигурирован")
    tier_config = TIERS[tier]
    session = stripe.checkout.Session.create(
        payment_method_types=["card"],
        mode="payment",
        line_items=[
            {
                "price_data": {
                    "currency": "usd",
                    "product_data": {
                        "name": f"Tezis — {tier_config['label']}",
                        "description": f"{tier_config['slides']} слайдов",
                    },
                    "unit_amount": tier_config["price_cents"],
                },
                "quantity": 1,
            }
        ],
        customer_email=user_email,
        success_url=f"{settings.FRONTEND_URL}/generation?order_id={order_id}",
        cancel_url=f"{settings.FRONTEND_URL}/payment?order_id={order_id}&cancelled=1",
        metadata={"order_id": order_id},
    )
    return session.url, session.id
