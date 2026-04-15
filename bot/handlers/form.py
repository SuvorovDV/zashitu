import io

from aiogram import F, Router
from aiogram.fsm.context import FSMContext
from aiogram.types import Message

from bot.keyboards.inline import (
    BTN_BACK, BTN_GENERATE, BTN_EDIT, BTN_SKIP, BTN_SLIDES,
    kb_back, kb_confirm, kb_custom_elements, kb_detail_level, kb_duration,
    kb_file_upload, kb_main, kb_mode, kb_palette, kb_remove, kb_tiers,
    kb_work_type,
)
from bot.states import FormStates
from config import DETAIL_LEVELS, INPUT_MODES, PALETTES, TIERS, WORK_TYPES
from storage.user_sessions import get_session

router = Router()

_WORK_TYPE_LABEL = {v: k for k, v in WORK_TYPES.items()}
_DETAIL_LABEL = {v: k for k, v in DETAIL_LEVELS.items()}
_MODE_LABEL = {v: k for k, v in INPUT_MODES.items()}
_PALETTE_LABEL = {v: k for k, v in PALETTES.items()}
_TIER_BY_LABEL = {t["label"]: key for key, t in TIERS.items()}


# ── Шаг 1: Тема ───────────────────────────────────────────────────────────────

async def show_step_topic(message: Message, state: FSMContext) -> None:
    await state.set_state(FormStates.topic)
    await message.answer(
        "📝 <b>Шаг 1 из 10</b>\n\nНапиши <b>тему</b> работы или доклада.\n\n"
        "<i>Пример: «Влияние цифровизации на рынок труда в России»</i>",
        reply_markup=kb_back(), parse_mode="HTML",
    )


@router.message(FormStates.topic)
async def step_topic(message: Message, state: FSMContext):
    if message.text == BTN_BACK:
        await state.clear()
        await message.answer("Главное меню:", reply_markup=kb_main())
        return
    get_session(message.chat.id).topic = message.text.strip()
    await state.set_state(FormStates.direction)
    await message.answer(
        "📚 <b>Шаг 2 из 10</b>\n\nУкажи <b>направление / предмет</b>.\n\n"
        "<i>Пример: «Экономика», «Информационные технологии»</i>",
        reply_markup=kb_back(), parse_mode="HTML",
    )


# ── Шаг 2: Направление ────────────────────────────────────────────────────────

@router.message(FormStates.direction)
async def step_direction(message: Message, state: FSMContext):
    if message.text == BTN_BACK:
        await show_step_topic(message, state)
        return
    get_session(message.chat.id).direction = message.text.strip()
    await state.set_state(FormStates.work_type)
    await message.answer(
        "🎓 <b>Шаг 3 из 10</b>\n\nВыбери <b>тип работы</b>:",
        reply_markup=kb_work_type(), parse_mode="HTML",
    )


# ── Шаг 3: Тип работы ─────────────────────────────────────────────────────────

@router.message(FormStates.work_type)
async def step_work_type(message: Message, state: FSMContext):
    if message.text == BTN_BACK:
        await state.set_state(FormStates.direction)
        await message.answer("📚 <b>Шаг 2 из 10</b>\n\nУкажи <b>направление / предмет</b>.",
                             reply_markup=kb_back(), parse_mode="HTML")
        return
    value = WORK_TYPES.get(message.text)
    if not value:
        await message.answer("Выбери тип из списка.", reply_markup=kb_work_type())
        return
    get_session(message.chat.id).work_type = value
    await state.set_state(FormStates.duration)
    await message.answer(
        "⏱ <b>Шаг 4 из 10</b>\n\nВыбери <b>длительность</b> выступления или укажи число слайдов:",
        reply_markup=kb_duration(), parse_mode="HTML",
    )


# ── Шаг 4: Длительность / слайды ──────────────────────────────────────────────

@router.message(FormStates.duration)
async def step_duration(message: Message, state: FSMContext):
    if message.text == BTN_BACK:
        await state.set_state(FormStates.work_type)
        await message.answer("🎓 <b>Шаг 3 из 10</b>\n\nВыбери <b>тип работы</b>:",
                             reply_markup=kb_work_type(), parse_mode="HTML")
        return
    if message.text == BTN_SLIDES:
        await state.set_state(FormStates.slides_input)
        await message.answer("📊 Напиши <b>количество слайдов</b> (например: 15):",
                             reply_markup=kb_back(), parse_mode="HTML")
        return
    raw = (message.text or "").replace("мин", "").strip()
    if not raw.isdigit() or int(raw) <= 0:
        await message.answer("⚠️ Выбери вариант из меню или напиши число минут.",
                             reply_markup=kb_duration())
        return
    session = get_session(message.chat.id)
    session.duration_minutes = int(raw)
    session.slides_count = 0
    await _go_to_detail(message, state)


@router.message(FormStates.slides_input)
async def step_slides_input(message: Message, state: FSMContext):
    if message.text == BTN_BACK:
        await state.set_state(FormStates.duration)
        await message.answer("⏱ <b>Шаг 4 из 10</b>\n\nВыбери длительность или кол-во слайдов:",
                             reply_markup=kb_duration(), parse_mode="HTML")
        return
    raw = (message.text or "").strip()
    if not raw.isdigit() or int(raw) <= 0:
        await message.answer("⚠️ Напиши число слайдов, например: <b>15</b>", parse_mode="HTML")
        return
    session = get_session(message.chat.id)
    session.slides_count = int(raw)
    session.duration_minutes = 0
    await _go_to_detail(message, state)


async def _go_to_detail(message: Message, state: FSMContext) -> None:
    await state.set_state(FormStates.detail_level)
    await message.answer(
        "📊 <b>Шаг 5 из 10</b>\n\nВыбери <b>уровень детализации</b>:\n\n"
        "• <b>Краткий</b> — 2–3 буллета на слайде, телеграфный стиль.\n"
        "• <b>Стандарт</b> — 3–5 буллетов, баланс содержания и лаконичности.\n"
        "• <b>Подробный</b> — 4–6 буллетов с конкретикой (числа, примеры). Только Премиум.",
        reply_markup=kb_detail_level(), parse_mode="HTML",
    )


# ── Шаг 5: Детализация ────────────────────────────────────────────────────────

@router.message(FormStates.detail_level)
async def step_detail_level(message: Message, state: FSMContext):
    if message.text == BTN_BACK:
        await state.set_state(FormStates.duration)
        await message.answer("⏱ <b>Шаг 4 из 10</b>\n\nВыбери длительность или кол-во слайдов:",
                             reply_markup=kb_duration(), parse_mode="HTML")
        return
    value = DETAIL_LEVELS.get(message.text)
    if not value:
        await message.answer("Выбери уровень из списка.", reply_markup=kb_detail_level())
        return
    get_session(message.chat.id).detail_level = value
    await state.set_state(FormStates.thesis)
    await message.answer(
        "💡 <b>Шаг 6 из 10</b>\n\nНапиши <b>ключевой тезис</b> одним предложением.\n\n"
        "<i>Пример: «Цифровизация создаёт рабочие места быстрее, чем уничтожает»</i>",
        reply_markup=kb_back(), parse_mode="HTML",
    )


# ── Шаг 6: Тезис ──────────────────────────────────────────────────────────────

@router.message(FormStates.thesis)
async def step_thesis(message: Message, state: FSMContext):
    if message.text == BTN_BACK:
        await state.set_state(FormStates.detail_level)
        await message.answer("📊 <b>Шаг 5 из 10</b>\n\nВыбери уровень детализации:",
                             reply_markup=kb_detail_level(), parse_mode="HTML")
        return
    get_session(message.chat.id).thesis = message.text.strip()
    await state.set_state(FormStates.university)
    await message.answer(
        "🏛 <b>Шаг 7 из 10</b>\n\nУкажи <b>учебное заведение</b>.\n\n"
        "<i>Пример: «НИУ ВШЭ, бакалавриат», «9 класс»</i>",
        reply_markup=kb_back(), parse_mode="HTML",
    )


# ── Шаг 7: ВУЗ / школа ────────────────────────────────────────────────────────

@router.message(FormStates.university)
async def step_university(message: Message, state: FSMContext):
    if message.text == BTN_BACK:
        await state.set_state(FormStates.thesis)
        await message.answer("💡 <b>Шаг 6 из 10</b>\n\nНапиши ключевой тезис.",
                             reply_markup=kb_back(), parse_mode="HTML")
        return
    get_session(message.chat.id).university = message.text.strip()
    await state.set_state(FormStates.custom_elements)
    await message.answer(
        "✏️ <b>Шаг 8 из 10</b>\n\nЧто <b>обязательно</b> должно быть в презентации?\n\n"
        "<i>Пример: «сравнительная таблица, 3 графика». Или пропусти.</i>",
        reply_markup=kb_custom_elements(), parse_mode="HTML",
    )


# ── Шаг 8: Обязательные элементы ──────────────────────────────────────────────

@router.message(FormStates.custom_elements)
async def step_custom_elements(message: Message, state: FSMContext):
    if message.text == BTN_BACK:
        await state.set_state(FormStates.university)
        await message.answer("🏛 <b>Шаг 7 из 10</b>\n\nУкажи учебное заведение.",
                             reply_markup=kb_back(), parse_mode="HTML")
        return
    session = get_session(message.chat.id)
    session.custom_elements = "" if message.text == BTN_SKIP else message.text.strip()
    await state.set_state(FormStates.mode)
    await message.answer(
        "📂 <b>Шаг 9 из 10</b>\n\nВыбери <b>режим</b>:\n\n"
        "• <b>По моей работе</b> — загружаешь PDF/DOCX, слайды со ссылками на страницы.\n"
        "• <b>С нуля</b> — бот сам придумает структуру по теме.",
        reply_markup=kb_mode(), parse_mode="HTML",
    )


# ── Шаг 9: Режим ──────────────────────────────────────────────────────────────

@router.message(FormStates.mode)
async def step_mode(message: Message, state: FSMContext):
    if message.text == BTN_BACK:
        await state.set_state(FormStates.custom_elements)
        await message.answer("✏️ <b>Шаг 8 из 10</b>\n\nЧто обязательно должно быть?",
                             reply_markup=kb_custom_elements(), parse_mode="HTML")
        return
    value = INPUT_MODES.get(message.text)
    if not value:
        await message.answer("Выбери режим из списка.", reply_markup=kb_mode())
        return
    get_session(message.chat.id).mode = value
    await state.set_state(FormStates.palette)
    await message.answer(
        "🎨 <b>Шаг 10 из 10</b>\n\nВыбери <b>цветовую палитру</b>:",
        reply_markup=kb_palette(), parse_mode="HTML",
    )


# ── Шаг 10: Палитра ───────────────────────────────────────────────────────────

@router.message(FormStates.palette)
async def step_palette(message: Message, state: FSMContext):
    if message.text == BTN_BACK:
        await state.set_state(FormStates.mode)
        await message.answer("📂 <b>Шаг 9 из 10</b>\n\nВыбери режим:",
                             reply_markup=kb_mode(), parse_mode="HTML")
        return
    value = PALETTES.get(message.text)
    if not value:
        await message.answer("Выбери палитру из списка.", reply_markup=kb_palette())
        return
    session = get_session(message.chat.id)
    session.palette = value
    # Detailed детализация доступна только для Premium — выставим её автоматически.
    if session.detail_level == "detailed":
        session.tier = "premium"
        await state.set_state(FormStates.tier)
        await _show_tier_summary(message, state)
        return
    await state.set_state(FormStates.tier)
    await message.answer(
        f"✅ Палитра: <b>{message.text}</b>\n\n💳 Выбери <b>тариф</b>:",
        reply_markup=kb_tiers(), parse_mode="HTML",
    )


# ── Тариф ─────────────────────────────────────────────────────────────────────

@router.message(FormStates.tier, F.text == BTN_BACK)
async def step_tier_back(message: Message, state: FSMContext):
    await state.set_state(FormStates.palette)
    await message.answer("🎨 <b>Шаг 10 из 10</b>\n\nВыбери цветовую палитру:",
                         reply_markup=kb_palette(), parse_mode="HTML")


@router.message(FormStates.tier)
async def step_tier(message: Message, state: FSMContext):
    key = _TIER_BY_LABEL.get(message.text)
    if not key:
        await message.answer("Выбери тариф из списка.", reply_markup=kb_tiers())
        return
    session = get_session(message.chat.id)
    # Валидация по лимитам тарифа (дублирует серверную, но даёт быстрый фидбек).
    tier = TIERS[key]
    if session.slides_count and session.slides_count > tier["max_slides"]:
        await message.answer(
            f"⚠️ Тариф «{tier['short']}» поддерживает до {tier['max_slides']} слайдов; "
            f"выбрано {session.slides_count}. Выбери тариф побольше.",
            reply_markup=kb_tiers(),
        )
        return
    if session.duration_minutes and session.duration_minutes > tier["max_duration_minutes"]:
        await message.answer(
            f"⚠️ Тариф «{tier['short']}» поддерживает до {tier['max_duration_minutes']} мин; "
            f"выбрано {session.duration_minutes}. Выбери тариф побольше.",
            reply_markup=kb_tiers(),
        )
        return
    if session.detail_level == "detailed" and key != "premium":
        await message.answer("⚠️ Уровень «Подробный» доступен только для Премиум.",
                             reply_markup=kb_tiers())
        return
    session.tier = key
    await _show_tier_summary(message, state)


async def _show_tier_summary(message: Message, state: FSMContext) -> None:
    session = get_session(message.chat.id)
    await state.set_state(FormStates.confirm)
    await message.answer(_build_summary(session), reply_markup=kb_confirm(), parse_mode="HTML")


# ── Подтверждение ─────────────────────────────────────────────────────────────

@router.message(FormStates.confirm, F.text == BTN_EDIT)
async def step_confirm_edit(message: Message, state: FSMContext):
    from storage.user_sessions import reset_session
    reset_session(message.chat.id)
    await state.clear()
    await message.answer("Начинаем заново. Главное меню:", reply_markup=kb_main())


@router.message(FormStates.confirm, F.text == BTN_GENERATE)
async def step_confirm_generate(message: Message, state: FSMContext):
    from bot.handlers.payment import start_payment_flow
    await start_payment_flow(message, state)


# ── Загрузка файла (только source_grounded) ───────────────────────────────────

@router.message(FormStates.file_upload, F.document)
async def step_file_upload(message: Message, state: FSMContext):
    from bot import api_client

    doc = message.document
    filename = doc.file_name or ""
    ext = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""
    if ext not in ("pdf", "docx"):
        await message.answer("⚠️ Поддерживаются только <b>PDF</b> и <b>DOCX</b>.", parse_mode="HTML")
        return

    await message.answer("⏳ Загружаю файл на сервер...", reply_markup=kb_remove())
    file = await message.bot.get_file(doc.file_id)
    buf = io.BytesIO()
    await message.bot.download_file(file.file_path, buf)
    content = buf.getvalue()

    mime = (
        "application/pdf" if ext == "pdf"
        else "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )
    session = get_session(message.chat.id)
    try:
        await api_client.upload_file(session.order_id, filename, content, mime)
    except api_client.BackendError as e:
        await message.answer(f"❌ Не удалось загрузить файл: {e.detail}")
        return

    session.file_uploaded = True
    await message.answer(f"✅ Файл загружен: <b>{filename}</b>", parse_mode="HTML")

    from bot.handlers.payment import proceed_to_invoice
    await proceed_to_invoice(message, state)


@router.message(FormStates.file_upload, F.text == BTN_BACK)
async def step_file_upload_back(message: Message, state: FSMContext):
    await state.set_state(FormStates.confirm)
    await _show_tier_summary(message, state)


@router.message(FormStates.file_upload)
async def step_file_upload_wrong(message: Message):
    await message.answer("📎 Пришли файл <b>PDF</b> или <b>DOCX</b>.",
                         reply_markup=kb_file_upload(), parse_mode="HTML")


# ── Вспомогательное ───────────────────────────────────────────────────────────

def _build_summary(session) -> str:
    tier = TIERS[session.tier]
    mode_label = _MODE_LABEL.get(session.mode, session.mode)
    palette_label = _PALETTE_LABEL.get(session.palette, session.palette)
    detail_label = _DETAIL_LABEL.get(session.detail_level, session.detail_level)
    work_type_label = _WORK_TYPE_LABEL.get(session.work_type, session.work_type)
    if session.slides_count:
        volume = f"{session.slides_count} слайдов"
    else:
        volume = f"{session.duration_minutes} мин"
    must_line = f"• Обязательно: {session.custom_elements}\n" if session.custom_elements else ""
    return (
        "📋 <b>Проверь данные перед оплатой</b>\n\n"
        f"• Тема: {session.topic}\n"
        f"• Направление: {session.direction}\n"
        f"• Тип работы: {work_type_label}\n"
        f"• Объём: {volume}\n"
        f"• Детализация: {detail_label}\n"
        f"• Тезис: {session.thesis}\n"
        f"• Учебное заведение: {session.university}\n"
        + must_line +
        f"• Режим: {mode_label}\n"
        f"• Палитра: {palette_label}\n"
        f"• Тариф: {tier['label']} (до {tier['max_slides']} слайдов)"
    )
