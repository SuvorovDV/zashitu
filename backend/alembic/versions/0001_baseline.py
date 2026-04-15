"""baseline: users, orders, uploaded_files

Revision ID: 0001_baseline
Revises:
Create Date: 2026-04-14

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0001_baseline"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("hashed_password", sa.String(), nullable=True),
        sa.Column("google_id", sa.String(), nullable=True),
        sa.Column("is_verified", sa.Boolean(), nullable=False, server_default=sa.text("1")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("email", name="uq_users_email"),
        sa.UniqueConstraint("google_id", name="uq_users_google_id"),
    )
    op.create_index("ix_users_email", "users", ["email"])

    op.create_table(
        "orders",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("user_id", sa.String(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("topic", sa.String(), nullable=False),
        sa.Column("direction", sa.String(), nullable=True),
        sa.Column("work_type", sa.String(), nullable=True),
        sa.Column("duration_minutes", sa.Integer(), nullable=True),
        sa.Column("detail_level", sa.String(), nullable=True),
        sa.Column("thesis", sa.Text(), nullable=True),
        sa.Column("university", sa.String(), nullable=True),
        sa.Column("required_elements", sa.String(), nullable=True),
        sa.Column("mode", sa.String(), nullable=True),
        sa.Column("palette", sa.String(), nullable=True),
        sa.Column("tier", sa.String(), nullable=False, server_default="basic"),
        sa.Column("status", sa.String(), nullable=False, server_default="pending"),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("stripe_session_id", sa.String(), nullable=True),
        sa.Column("stripe_payment_intent", sa.String(), nullable=True),
        sa.Column("output_filename", sa.String(), nullable=True),
        sa.Column("generation_prompt", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_orders_user_id", "orders", ["user_id"])
    op.create_index("ix_orders_status", "orders", ["status"])
    op.create_index("ix_orders_stripe_session_id", "orders", ["stripe_session_id"])
    op.create_index("ix_orders_stripe_payment_intent", "orders", ["stripe_payment_intent"])
    op.create_index("ix_orders_created_at", "orders", ["created_at"])

    op.create_table(
        "uploaded_files",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("order_id", sa.String(), sa.ForeignKey("orders.id"), nullable=False),
        sa.Column("original_filename", sa.String(), nullable=False),
        sa.Column("stored_filename", sa.String(), nullable=False),
        sa.Column("file_type", sa.String(), nullable=False),
        sa.Column("file_size", sa.Integer(), nullable=False),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("order_id", name="uq_uploaded_file_order"),
    )
    op.create_index("ix_uploaded_files_order_id", "uploaded_files", ["order_id"])


def downgrade() -> None:
    op.drop_index("ix_uploaded_files_order_id", "uploaded_files")
    op.drop_table("uploaded_files")
    op.drop_index("ix_orders_created_at", "orders")
    op.drop_index("ix_orders_stripe_payment_intent", "orders")
    op.drop_index("ix_orders_stripe_session_id", "orders")
    op.drop_index("ix_orders_status", "orders")
    op.drop_index("ix_orders_user_id", "orders")
    op.drop_table("orders")
    op.drop_index("ix_users_email", "users")
    op.drop_table("users")
