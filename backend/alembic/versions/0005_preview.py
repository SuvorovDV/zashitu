"""add preview_count to orders

Revision ID: 0005_preview
Revises: 0004_slides_count
Create Date: 2026-04-14
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0005_preview"
down_revision: Union[str, None] = "0004_slides_count"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("orders", sa.Column("preview_count", sa.Integer(), nullable=False, server_default="0"))


def downgrade() -> None:
    op.drop_column("orders", "preview_count")
