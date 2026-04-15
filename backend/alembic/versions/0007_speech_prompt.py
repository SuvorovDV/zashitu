"""add speech_prompt to orders

Revision ID: 0007_speech_prompt
Revises: 0006_notes
Create Date: 2026-04-14
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0007_speech_prompt"
down_revision: Union[str, None] = "0006_notes"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("orders", sa.Column("speech_prompt", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("orders", "speech_prompt")
