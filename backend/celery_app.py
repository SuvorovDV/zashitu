from celery import Celery
from config import settings

celery = Celery(
    "zashitu",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=["generation.tasks"],
)

celery.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    # В тестовом режиме задачи выполняются синхронно без воркера
    task_always_eager=settings.CELERY_TASK_ALWAYS_EAGER,
    task_eager_propagates=True,
    # Таймауты генерации: soft даёт шанс залогировать, hard прерывает жёстко.
    task_soft_time_limit=600,   # 10 минут
    task_time_limit=720,        # 12 минут
    task_acks_late=True,
    worker_prefetch_multiplier=1,
)
