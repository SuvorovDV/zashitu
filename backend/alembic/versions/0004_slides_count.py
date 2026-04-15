"""add slides_count to orders

Revision ID: 0004_slides_count
Revises: 0003_revisions
Create Date: 2026-04-14
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0004_slides_count"
down_revision: Union[str, None] = "0003_revisions"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("orders", sa.Column("slides_count", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("orders", "slides_count")
