"""add include_speech + speech_text to orders

Revision ID: 0002_speech
Revises: 0001_baseline
Create Date: 2026-04-14

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0002_speech"
down_revision: Union[str, None] = "0001_baseline"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "orders",
        sa.Column("include_speech", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column("orders", sa.Column("speech_text", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("orders", "speech_text")
    op.drop_column("orders", "include_speech")
