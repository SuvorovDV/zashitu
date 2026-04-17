# Деплой Tezis / ZaShitu

Все 6 сервисов (Postgres, Redis, backend, Celery worker, Caddy+фронт, Telegram-бот) крутятся на одной VM под одним `docker compose`. Проект называется `deploy` (от имени папки); volumes именуются `deploy_*`, данные пользователей живут в volumes между релизами.

История: первоначально прод стоял на Yandex Cloud (`111.88.153.18`, `erkobrax`), 2026-04-16 мигрировали на FirstVDS KVM в Алматы. Заметки ниже — про текущий прод.

---

## Боевое окружение

| Параметр | Значение |
|---|---|
| Провайдер | FirstVDS KVM (Алматы) |
| IP | `176.12.79.36` |
| Hostname | `erkobraxx.hlab.kz` |
| ОС | Ubuntu 24.04, 2 ядра / 4 ГБ RAM / 60 ГБ NVMe |
| Пользователь | `root` (SSH по ключу) |
| Путь к коду | `~/zashitu/` |
| Compose-файл | `~/zashitu/deploy/docker-compose.prod.yml` |
| Env-файл | `~/zashitu/deploy/.env.prod` (chmod 600) |
| `.env` для интерполяции | симлинк `~/zashitu/deploy/.env → .env.prod` — нужен, чтобы `docker compose` резолвил `${DEV_TOKEN}` и т.п. из того же файла, что и контейнеры |
| Project name | `deploy` (передаётся флагом `-p deploy`) |
| Публичный домен | `https://tezis.176.12.79.36.nip.io` (Caddy + nip.io auto-TLS) |
| Бот | `@ai_presentations_test_bot` (Telegram, polling напрямую в `api.telegram.org`) |

---

## Команды управления

Заходим:
```bash
ssh root@176.12.79.36
cd ~/zashitu/deploy
```

Дальше во всех командах — относительно `~/zashitu/deploy`.

Статус и логи:
```bash
docker compose -p deploy -f docker-compose.prod.yml ps
docker compose -p deploy -f docker-compose.prod.yml logs -f bot
docker compose -p deploy -f docker-compose.prod.yml logs --tail=50 backend
docker compose -p deploy -f docker-compose.prod.yml logs --tail=50 worker
```

Перезапуск одного сервиса без пересборки:
```bash
docker compose -p deploy -f docker-compose.prod.yml restart backend
```

Пересборка после правки кода (пример — бот и бэкенд):
```bash
docker compose -p deploy -f docker-compose.prod.yml up -d --no-deps --build backend worker bot
```

Полный релиз (всё пересобрать, оставив volumes):
```bash
docker compose -p deploy -f docker-compose.prod.yml up -d --build
```

Остановить всё (без потери данных):
```bash
docker compose -p deploy -f docker-compose.prod.yml down
```

> Флаг `--env-file` явно не нужен: симлинк `.env → .env.prod` в каталоге compose решает интерполяцию автоматически.

---

## Обновление кода

Git на VM не настроен (см. PROGRESS.md «Следующий шаг»). Пока обновления через scp:

```bash
# На локальной машине (из корня монорепы):
tar --exclude='.git' --exclude='.venv' --exclude='__pycache__' \
    --exclude='.idea' --exclude='.env' --exclude='.claude' \
    --exclude='frontend/node_modules' --exclude='frontend/dist' \
    --exclude='backend/.venv' --exclude='backend/__pycache__' \
    --exclude='backend/uploads/*' --exclude='backend/outputs/*' \
    -czf /tmp/zashitu.tgz .
scp /tmp/zashitu.tgz root@176.12.79.36:/tmp/

# На VM:
cd ~/zashitu
cp deploy/.env.prod /tmp/env.prod.bak
find . -mindepth 1 -maxdepth 1 ! -name "." -exec rm -rf {} +
tar xzf /tmp/zashitu.tgz
cp /tmp/env.prod.bak deploy/.env.prod
ln -sfn .env.prod deploy/.env   # симлинк может не сохраниться после tar/rm
docker compose -p deploy -f deploy/docker-compose.prod.yml up -d --build
```

Для точечных правок (один файл) — просто `scp file root@176.12.79.36:~/zashitu/<path>` + `docker compose ... up -d`.

---

## Конфигурация (`deploy/.env.prod`)

Единый env для всех контейнеров (бот + бэкенд + воркер):

| Переменная | Назначение |
|---|---|
| `BOT_TOKEN` | токен от @BotFather |
| `BACKEND_URL` | `http://backend:8000` (DNS внутри `deploy_default`) |
| `BACKEND_INTERNAL_SECRET` + `BOT_INTERNAL_SECRET` | **одинаковое значение**, заголовок `X-Bot-Secret` |
| `POSTGRES_PASSWORD` | пароль postgres (читается контейнером через `env_file`, и подставляется в `DATABASE_URL`) |
| `DATABASE_URL` | `postgresql+asyncpg://zashitu:${POSTGRES_PASSWORD}@postgres:5432/zashitu_db` |
| `REDIS_URL` / `CELERY_*` | `redis://redis:6379/0` |
| `SECRET_KEY` | JWT-секрет (32 байта hex) |
| `ALLOWED_HOSTS` | `tezis.176.12.79.36.nip.io,backend,localhost` — **обязательно включить `backend`**, иначе бот получит 400 Invalid host header |
| `FRONTEND_URL` | `https://tezis.176.12.79.36.nip.io` |
| `ANTHROPIC_API_KEY` | ключ Claude API. Наличие ключа = реальная генерация, пусто = placeholder-контент. Подключён 2026-04-17. |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | пока пусты → `/payments/checkout` возвращает 503. На вебе работает `/dev/*` (симуляция оплаты) при `DEV_MODE=True` |
| `DEV_MODE` | `True` пока Stripe не подключён (доступны `/dev/*` эндпоинты) |
| `DEV_TOKEN` | токен, который Vite-бандл фронта сверяет с бэкендом для `/dev/*`. Build-time arg — при смене нужна пересборка `--build frontend` |
| `GENERATION_MODE` | **вестигиальный**, не влияет на выбор claude vs placeholder (решает наличие `ANTHROPIC_API_KEY`). Можно убрать при следующем рефакторе |
| `COOKIE_SECURE` / `COOKIE_SAMESITE` | `True` / `lax` на HTTPS |

---

## Диагностика

Бот не отвечает в Telegram:
```bash
docker compose -p deploy -f docker-compose.prod.yml logs --tail=50 bot
# Ожидаемо: "Run polling for bot @ai_presentations_test_bot"

# Telegram видит бота?
source .env.prod
curl -s "https://api.telegram.org/bot${BOT_TOKEN}/getMe"
curl -s "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo"
# webhook.url должен быть пустой (иначе polling конфликтует)
```

Бот ↔ бэкенд связность:
```bash
SECRET=$(grep '^BACKEND_INTERNAL_SECRET=' .env.prod | cut -d= -f2-)
docker exec deploy-bot-1 python -c "
import httpx
r = httpx.get('http://backend:8000/orders/', headers={'X-Bot-Secret': '${SECRET}'})
print(r.status_code, r.text[:100])
"
# 200 [...] — бэкенд жив, секрет совпадает.
```

Веб доступен:
```bash
curl -sI https://tezis.176.12.79.36.nip.io
# HTTP/2 200
```

Postgres жив и данные на месте:
```bash
docker exec deploy-postgres-1 psql -U zashitu -d zashitu_db -c "SELECT count(*) FROM users;"
```

Claude-интеграция живая:
```bash
docker exec deploy-backend-1 python -c "
import os
from anthropic import Anthropic
c = Anthropic(api_key=os.environ['ANTHROPIC_API_KEY'])
r = c.messages.create(model='claude-haiku-4-5-20251001', max_tokens=10,
                      messages=[{'role':'user','content':'Say pong'}])
print(r.content[0].text)
"
# Ожидаемо: Pong
```

---

## Подводные камни

### Пересоздание postgres → пул соединений в backend/worker мёртв

Если `docker compose up -d` пересоздаёт контейнер `postgres` (например, после правки его секции в compose-файле), SQLAlchemy-пул в `deploy-backend-1` и `deploy-worker-1` остаётся с коннектами на прежний контейнер. Первый запрос отдаёт **500: `connection is closed`**.

Фикс — сразу после пересоздания postgres рестартнуть consumer'ы:
```bash
docker compose -p deploy -f docker-compose.prod.yml restart backend worker
```

### `docker compose` ругается `variable is not set`

Варнинги про `POSTGRES_PASSWORD`, `DEV_TOKEN` и т.п. означают, что compose-файл пытается интерполировать `${VAR}` из shell env или файла `.env` рядом с compose, а не находит. На VM это лечит симлинк `.env → .env.prod`. Если симлинк пропал после `tar`/`rm`:
```bash
cd ~/zashitu/deploy && ln -sfn .env.prod .env
```

### Бот получает 400 Invalid host header от бэкенда

`ALLOWED_HOSTS` в `.env.prod` должен содержать `backend` и `localhost` помимо публичного домена. Без этого Django-стиль host-проверка в FastAPI ломает внутренний трафик.

### Celery `CPendingDeprecationWarning` про `broker_connection_retry`

Косметика, игнорируем. Чинится параметром `broker_connection_retry_on_startup=True` в celery-конфиге; когда/если обновим Celery до 6.x — зафиксить.

---

## Бэкапы

Ручной снапшот postgres:
```bash
docker exec deploy-postgres-1 pg_dump -U zashitu zashitu_db -Fc -f /tmp/backup.dump
docker cp deploy-postgres-1:/tmp/backup.dump ./backup-$(date +%Y%m%d).dump
```

Файлы (`uploads/`, `outputs/`) — docker named volumes `deploy_uploads`, `deploy_outputs`. Снапшот:
```bash
docker run --rm -v deploy_uploads:/src -v $PWD:/dst alpine tar czf /dst/uploads-$(date +%Y%m%d).tgz /src
```

Автоматического бэкапа пока нет — завести при росте базы.
