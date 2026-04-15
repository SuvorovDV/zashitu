"""Оплата и доставка готовой презентации.

Flow:
  confirm → create_order на бэкенде → (source_grounded? upload файла)
    → send_invoice (Stars) → successful_payment → confirm_payment → poll status
    → download .pptx → отдать юзеру.
"""
import asyncio
import logging

from aiogram import F, Router
from aiogram.enums import ChatAction
from aiogram.fsm.context import FSMContext
from aiogram.types import (
    BufferedInputFile, LabeledPrice, Message, PreCheckoutQuery,
)

from bot import api_client
from bot.keyboards.inline import kb_file_upload, kb_main, kb_remove
from bot.states import FormStates
from config import DEBUG_SKIP_PAYMENT, TIERS
from storage.user_sessions import clear_session, get_session

log = logging.getLogger(__name__)
router = Router()

# Интервал и лимит polling'а статуса генерации (web-бэкенд обычно отдаёт
# .pptx за 30–90 сек; даём запас до 5 минут).
_POLL_INTERVAL_SEC = 4
_POLL_TIMEOUT_SEC = 300


# ── Вход из формы: создаём заказ, решаем, что дальше ─────────────────────────

async def start_payment_flow(message: Message, state: FSMContext) -> None:
    session = get_session(message.chat.id)

    payload = {
        "topic": session.topic,
        "direction": session.direction or None,
        "work_type": session.work_type or None,
        "duration_minutes": session.duration_minutes or None,
        "slides_count": session.slides_count or None,
        "detail_level": session.detail_level or None,
        "thesis": session.thesis or None,
        "university": session.university or None,
        "custom_elements": session.custom_elements or None,
        "mode": session.mode or None,
        "palette": session.palette or None,
        "tier": session.tier or "basic",
        "include_speech": False,
    }
    await message.answer("⏳ Создаю заказ...", reply_markup=kb_remove())
    try:
        order_id = await api_client.create_order(payload)
    except api_client.BackendError as e:
        await message.answer(f"❌ Ошибка при создании заказа: {e.detail}", reply_markup=kb_main())
        await state.clear()
        clear_session(message.chat.id)
        return
    session.order_id = order_id

    if session.mode == "source_grounded" and not session.file_uploaded:
        await state.set_state(FormStates.file_upload)
        await message.answer(
            "📎 <b>Загрузи свою работу</b> (PDF или DOCX).\n\n"
            "Каждый слайд будет содержать ссылку на страницу работы.",
            reply_markup=kb_file_upload(), parse_mode="HTML",
        )
        return

    await proceed_to_invoice(message, state)


# ── Выставление счёта (или симуляция оплаты в debug) ─────────────────────────

async def proceed_to_invoice(message: Message, state: FSMContext) -> None:
    session = get_session(message.chat.id)
    tier = TIERS[session.tier]

    if DEBUG_SKIP_PAYMENT:
        await state.set_state(FormStates.generating)
        await message.answer("🔧 Дебаг: оплата пропущена.", reply_markup=kb_remove())
        await _confirm_and_deliver(message, session.order_id)
        return

    await message.answer("💳 Выставляю счёт...", reply_markup=kb_remove())
    await message.answer_invoice(
        title="Генерация презентации",
        description=f"{tier['label']} — до {tier['max_slides']} слайдов",
        payload=f"order:{session.order_id}",
        currency="XTR",
        prices=[LabeledPrice(label=tier["label"], amount=tier["price_stars"])],
    )


# ── Stars ─────────────────────────────────────────────────────────────────────

@router.pre_checkout_query()
async def pre_checkout(query: PreCheckoutQuery):
    await query.answer(ok=True)


@router.message(F.successful_payment)
async def successful_payment(message: Message, state: FSMContext):
    session = get_session(message.chat.id)
    if not session.order_id:
        # Заказ потерян (рестарт бота?) — сообщаем и выходим.
        await message.answer(
            "⚠️ Оплата прошла, но я потерял контекст заказа. "
            "Напиши в поддержку с ID платежа.",
            reply_markup=kb_main(),
        )
        return
    await state.set_state(FormStates.generating)
    await message.answer("✅ Оплата прошла. Генерирую презентацию...")
    await _confirm_and_deliver(message, session.order_id)


# ── Подтверждение + polling + выдача файла ───────────────────────────────────

async def _confirm_and_deliver(message: Message, order_id: str) -> None:
    try:
        await api_client.confirm_payment(order_id)
    except api_client.BackendError as e:
        await message.answer(
            f"❌ Не удалось запустить генерацию: {e.detail}", reply_markup=kb_main()
        )
        clear_session(message.chat.id)
        return

    waited = 0
    last_status = ""
    while waited < _POLL_TIMEOUT_SEC:
        await message.bot.send_chat_action(message.chat.id, ChatAction.UPLOAD_DOCUMENT)
        try:
            status = await api_client.get_status(order_id)
        except api_client.BackendError as e:
            log.warning("status poll failed: %s", e)
            await asyncio.sleep(_POLL_INTERVAL_SEC)
            waited += _POLL_INTERVAL_SEC
            continue

        state = status.get("status")
        if state != last_status:
            log.info("order %s status=%s", order_id, state)
            last_status = state

        if state == "done":
            await _send_pptx(message, order_id)
            return
        if state == "failed":
            await message.answer(
                f"❌ Генерация не удалась: {status.get('error_message') or 'неизвестная ошибка'}",
                reply_markup=kb_main(),
            )
            clear_session(message.chat.id)
            return

        await asyncio.sleep(_POLL_INTERVAL_SEC)
        waited += _POLL_INTERVAL_SEC

    await message.answer(
        "⌛ Генерация идёт дольше обычного. Напиши /start позже — файл будет ждать.",
        reply_markup=kb_main(),
    )


async def _send_pptx(message: Message, order_id: str) -> None:
    try:
        content, filename = await api_client.download_pptx(order_id)
    except api_client.BackendError as e:
        await message.answer(f"❌ Не удалось скачать файл: {e.detail}", reply_markup=kb_main())
        clear_session(message.chat.id)
        return
    session = get_session(message.chat.id)
    tier_label = TIERS.get(session.tier, {}).get("label", session.tier)
    await message.answer_document(
        BufferedInputFile(content, filename=filename),
        caption=f"✅ Готово! Тариф: {tier_label}",
        reply_markup=kb_main(),
    )
    clear_session(message.chat.id)
