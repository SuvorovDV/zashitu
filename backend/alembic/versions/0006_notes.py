"""add custom_elements + revision notes to orders

Revision ID: 0006_notes
Revises: 0005_preview
Create Date: 2026-04-14
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0006_notes"
down_revision: Union[str, None] = "0005_preview"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("orders", sa.Column("custom_elements", sa.Text(), nullable=True))
    op.add_column("orders", sa.Column("speech_revision_note", sa.Text(), nullable=True))
    op.add_column("orders", sa.Column("slides_revision_note", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("orders", "slides_revision_note")
    op.drop_column("orders", "speech_revision_note")
    op.drop_column("orders", "custom_elements")
