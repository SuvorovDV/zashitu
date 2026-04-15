import asyncio
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from aiogram import Bot, Dispatcher
from aiogram.client.session.aiohttp import AiohttpSession
from aiogram.client.telegram import TelegramAPIServer
from aiogram.fsm.storage.memory import MemoryStorage

from config import BOT_TOKEN, TELEGRAM_API_SERVER
from bot.handlers import form, payment, start

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
log = logging.getLogger(__name__)


async def main():
    if TELEGRAM_API_SERVER:
        api = TelegramAPIServer.from_base(TELEGRAM_API_SERVER.rstrip("/"))
        session = AiohttpSession(api=api)
        log.info("Using custom Telegram API server: %s", TELEGRAM_API_SERVER)
        bot = Bot(token=BOT_TOKEN, session=session)
    else:
        bot = Bot(token=BOT_TOKEN)
    dp = Dispatcher(storage=MemoryStorage())

    dp.include_router(start.router)
    dp.include_router(form.router)
    dp.include_router(payment.router)

    log.info("ZaShitu bot starting...")
    await dp.start_polling(bot, allowed_updates=dp.resolve_used_update_types())


if __name__ == "__main__":
    asyncio.run(main())
