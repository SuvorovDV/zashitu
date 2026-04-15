"""add presenter fields to orders

Revision ID: 0008_presenter
Revises: 0007_speech_prompt
Create Date: 2026-04-14
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0008_presenter"
down_revision: Union[str, None] = "0007_speech_prompt"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("orders", sa.Column("presenter_name", sa.String(), nullable=True))
    op.add_column("orders", sa.Column("presenter_role", sa.String(), nullable=True))
    op.add_column("orders", sa.Column("skip_tech_details", sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade() -> None:
    op.drop_column("orders", "skip_tech_details")
    op.drop_column("orders", "presenter_role")
    op.drop_column("orders", "presenter_name")
