from celery import Celery

from app.core.config import settings

celery_app = Celery(
    "codearena",
    broker=settings.REDIS_URL,
    include=["app.worker.tasks"],
)

celery_app.conf.update(
    task_acks_late=True,           # if the worker crashes mid-job, the job is retried
    worker_prefetch_multiplier=1,  # take one job at a time
    broker_connection_retry_on_startup=True,
)