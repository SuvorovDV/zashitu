"""add revisions/approvals columns to orders

Revision ID: 0003_revisions
Revises: 0002_speech
Create Date: 2026-04-14
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0003_revisions"
down_revision: Union[str, None] = "0002_speech"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("orders", sa.Column("speech_revisions", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("orders", sa.Column("slides_revisions", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("orders", sa.Column("speech_approved", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("orders", sa.Column("slides_approved", sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade() -> None:
    op.drop_column("orders", "slides_approved")
    op.drop_column("orders", "speech_approved")
    op.drop_column("orders", "slides_revisions")
    op.drop_column("orders", "speech_revisions")
