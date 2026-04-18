import uuid
from datetime import datetime, timezone
from enum import Enum as PyEnum
from sqlalchemy import (
    String, Boolean, DateTime, Integer, ForeignKey,
    Text, UniqueConstraint, Index
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from database import Base


def utcnow():
    return datetime.now(timezone.utc)


class OrderStatus(str, PyEnum):
    pending = "pending"
    paid = "paid"
    generating = "generating"
    # Промежуточное состояние между этапами approval-флоу (текст/слайды).
    awaiting_review = "awaiting_review"
    done = "done"
    failed = "failed"


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    email: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    hashed_password: Mapped[str | None] = mapped_column(String, nullable=True)
    google_id: Mapped[str | None] = mapped_column(String, unique=True, nullable=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    orders: Mapped[list["Order"]] = relationship("Order", back_populates="user")


class Order(Base):
    __tablename__ = "orders"
    __table_args__ = (
        Index("ix_orders_user_id", "user_id"),
        Index("ix_orders_status", "status"),
        Index("ix_orders_stripe_session_id", "stripe_session_id"),
        Index("ix_orders_stripe_payment_intent", "stripe_payment_intent"),
        Index("ix_orders_created_at", "created_at"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False)

    # Поля формы
    topic: Mapped[str] = mapped_column(String, nullable=False)
    direction: Mapped[str | None] = mapped_column(String, nullable=True)
    work_type: Mapped[str | None] = mapped_column(String, nullable=True)
    duration_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # Опционально — пользователь задал точное число слайдов вместо длительности.
    # Если задано, переопределяет n_slides тарифа.
    slides_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    detail_level: Mapped[str | None] = mapped_column(String, nullable=True)
    thesis: Mapped[str | None] = mapped_column(Text, nullable=True)
    university: Mapped[str | None] = mapped_column(String, nullable=True)
    required_elements: Mapped[str | None] = mapped_column(String, nullable=True)  # JSON строка
    mode: Mapped[str | None] = mapped_column(String, nullable=True)
    palette: Mapped[str | None] = mapped_column(String, nullable=True)

    tier: Mapped[str] = mapped_column(String, nullable=False, default="basic")
    # String (а не Enum) для совместимости с SQLite/без миграций.
    # Всегда храним OrderStatus.<name>.value — никогда enum напрямую.
    status: Mapped[str] = mapped_column(
        String,
        nullable=False,
        default=OrderStatus.pending.value,
    )
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    stripe_session_id: Mapped[str | None] = mapped_column(String, nullable=True)
    stripe_payment_intent: Mapped[str | None] = mapped_column(String, nullable=True)
    output_filename: Mapped[str | None] = mapped_column(String, nullable=True)
    generation_prompt: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON-план слайдов
    # Количество отрендеренных PNG-превью (по одному на слайд).
    preview_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Пользовательский free-text «что обязательно должно быть» — дополнение к required_elements.
    custom_elements: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Последняя подсказка пользователя при regenerate («поменяй это», «добавь то»).
    # Используется одним следующим запуском задачи и очищается.
    speech_revision_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    slides_revision_note: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Технический промт текста выступления — JSON {system, user, model, raw_response}.
    # Нужен для отладки («скопировал, прогнал в Claude локально»).
    speech_prompt: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Для продуктовых/личных проектов — выводим имя и роль докладчика в опенер.
    presenter_name: Mapped[str | None] = mapped_column(String, nullable=True)
    presenter_role: Mapped[str | None] = mapped_column(String, nullable=True)
    # Гейт: «не углубляться в техническую реализацию» — пишется в system-промт.
    skip_tech_details: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # Включает второй артефакт — текст выступления в Markdown.
    include_speech: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    speech_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Юзер принёс готовый текст речи — пайплайн пропускает Claude-генерацию
    # и копирует user_speech_text в speech_text с speech_approved=True.
    speech_is_user_provided: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    user_speech_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Юзер разрешил Claude дополнять фактами из общих знаний (не только из источника).
    # При allow_enhance=True source_ref помечается «общее знание» на соответствующих слайдах.
    # USP-compromise, см. DECISIONS.md «Enhance mode».
    allow_enhance: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Итеративный approval-флоу для include_speech=True:
    # speech сначала, потом slides. Каждая фаза — N правок перед approve.
    speech_revisions: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    slides_revisions: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    speech_approved: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    slides_approved: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    user: Mapped["User"] = relationship("User", back_populates="orders")
    uploaded_file: Mapped["UploadedFile | None"] = relationship(
        "UploadedFile", back_populates="order", uselist=False
    )


class UploadedFile(Base):
    __tablename__ = "uploaded_files"
    __table_args__ = (
        UniqueConstraint("order_id", name="uq_uploaded_file_order"),
        Index("ix_uploaded_files_order_id", "order_id"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    order_id: Mapped[str] = mapped_column(String, ForeignKey("orders.id"), nullable=False)
    original_filename: Mapped[str] = mapped_column(String, nullable=False)
    stored_filename: Mapped[str] = mapped_column(String, nullable=False)
    file_type: Mapped[str] = mapped_column(String, nullable=False)  # pdf|docx
    file_size: Mapped[int] = mapped_column(Integer, nullable=False)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    order: Mapped["Order"] = relationship("Order", back_populates="uploaded_file")
