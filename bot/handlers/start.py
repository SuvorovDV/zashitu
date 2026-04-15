from aiogram import F, Router
from aiogram.filters import CommandStart
from aiogram.fsm.context import FSMContext
from aiogram.types import CallbackQuery, Message

from bot.keyboards.inline import BTN_CREATE, BTN_HOW, kb_accept_terms, kb_main
from storage.user_sessions import get_session

router = Router()

TERMS_TEXT = (
    "⚠️ <b>Важно перед началом</b>\n\n"
    "ZaShitu генерирует презентации по твоим данным. "
    "Материалы носят <b>справочный характер</b>. "
    "Ответственность за использование лежит на пользователе.\n\n"
    "Нажимая «Принять», ты соглашаешься с условиями сервиса."
)

WELCOME_TEXT = (
    "👋 Привет! Я <b>ZaShitu</b> — бот для быстрого создания академических презентаций.\n\n"
    "Что умею:\n"
    "• Собирать параметры работы через простой диалог\n"
    "• Загружать твою работу (PDF/DOCX) и привязывать слайды к страницам\n"
    "• Отдавать готовый .pptx за 1–2 минуты\n\n"
    "Готов начать?"
)

HOW_IT_WORKS_TEXT = (
    "📋 <b>Как это работает</b>\n\n"
    "1. Отвечаешь на 10 вопросов о работе\n"
    "2. Выбираешь тариф\n"
    "3. Загружаешь PDF/DOCX (если режим «По моей работе»)\n"
    "4. Оплачиваешь Telegram Stars\n"
    "5. Через 1–2 минуты получаешь .pptx\n\n"
    "<b>Тарифы:</b>\n"
    "• Базовый 99⭐ — до 12 слайдов\n"
    "• Стандарт 199⭐ — до 20 слайдов\n"
    "• Премиум 399⭐ — до 30 слайдов, модель Opus 4.6"
)


@router.message(CommandStart())
async def cmd_start(message: Message, state: FSMContext):
    await state.clear()
    session = get_session(message.chat.id)
    if not session.terms_accepted:
        await message.answer(TERMS_TEXT, reply_markup=kb_accept_terms(), parse_mode="HTML")
    else:
        await message.answer(WELCOME_TEXT, reply_markup=kb_main(), parse_mode="HTML")


@router.callback_query(F.data == "accept_terms")
async def cb_accept_terms(callback: CallbackQuery):
    get_session(callback.message.chat.id).terms_accepted = True
    await callback.message.edit_text(WELCOME_TEXT, parse_mode="HTML")
    await callback.message.answer("Выбери действие:", reply_markup=kb_main())
    await callback.answer()


@router.message(F.text == BTN_CREATE)
async def msg_create(message: Message, state: FSMContext):
    from bot.handlers.form import show_step_topic
    await show_step_topic(message, state)


@router.message(F.text == BTN_HOW)
async def msg_how(message: Message):
    await message.answer(HOW_IT_WORKS_TEXT, reply_markup=kb_main(), parse_mode="HTML")
