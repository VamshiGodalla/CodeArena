# CodeArena

Online coding judge: FastAPI + PostgreSQL + Redis/Celery + Docker sandbox + React.

## Run locally (Day 1)

```bash
cp .env.example .env
docker compose up --build -d
docker compose exec api alembic revision --autogenerate -m "initial tables"
docker compose exec api alembic upgrade head
curl http://localhost:8000/health
```

API docs: http://localhost:8000/docs
