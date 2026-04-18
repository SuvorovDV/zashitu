"""add user-provided speech and enhance mode fields to orders

Revision ID: 0009_speech_and_enhance
Revises: 0008_presenter
Create Date: 2026-04-18
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0009_speech_and_enhance"
down_revision: Union[str, None] = "0008_presenter"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "orders",
        sa.Column("speech_is_user_provided", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column("orders", sa.Column("user_speech_text", sa.Text(), nullable=True))
    op.add_column(
        "orders",
        sa.Column("allow_enhance", sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column("orders", "allow_enhance")
    op.drop_column("orders", "user_speech_text")
    op.drop_column("orders", "speech_is_user_provided")
