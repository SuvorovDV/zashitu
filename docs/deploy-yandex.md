# Деплой ZaShitu на Yandex Cloud

Все 6 сервисов (Postgres, Redis, backend, Celery worker, Caddy+фронт, Telegram-бот) крутятся на одной VM Yandex Cloud под одним `docker compose`. Проект называется `deploy` (от имени папки); volumes именуются `deploy_*`.

---

## Боевое окружение

| Параметр | Значение |
|---|---|
| IP | `111.88.153.18` |
| Пользователь | `erkobrax` |
| Путь к коду | `~/zashitu/` |
| Compose-файл | `~/zashitu/deploy/docker-compose.prod.yml` |
| Env-файл | `~/zashitu/deploy/.env.prod` (chmod 600) |
| Project name | `deploy` (передаётся флагом `-p deploy`) |
| Домен | `https://tezis.111.88.153.18.nip.io` (Caddy + nip.io auto-TLS) |
| Бот | `@ai_presentations_test_bot` |
| TG-прокси | `https://tg-bot-proxy.erkobraxx.workers.dev` (Cloudflare Worker) |

---

## Команды управления

Заходим:
```bash
ssh -i <ваш-ключ> erkobrax@111.88.153.18
cd ~/zashitu
```

Статус:
```bash
docker compose -p deploy -f deploy/docker-compose.prod.yml ps
docker compose -p deploy -f deploy/docker-compose.prod.yml logs -f bot
docker compose -p deploy -f deploy/docker-compose.prod.yml logs --tail=50 backend
```

Перезапуск одного сервиса без пересборки:
```bash
docker compose -p deploy -f deploy/docker-compose.prod.yml restart backend
```

Пересборка после правки кода (пример — бот и бэкенд):
```bash
docker compose -p deploy -f deploy/docker-compose.prod.yml --env-file deploy/.env.prod up -d --no-deps --build backend worker bot
```

Полный релиз (всё пересобрать, оставив volumes):
```bash
docker compose -p deploy -f deploy/docker-compose.prod.yml --env-file deploy/.env.prod up -d --build
```

Остановить всё (без потери данных):
```bash
docker compose -p deploy -f deploy/docker-compose.prod.yml down
```

---

## Обновление кода

Git на VM сейчас не настроен — обновления через scp:

```bash
# На локальной машине (из корня монорепы):
tar --exclude='.git' --exclude='.venv' --exclude='__pycache__' \
    --exclude='.idea' --exclude='.env' --exclude='.claude' \
    --exclude='frontend/node_modules' --exclude='frontend/dist' \
    --exclude='backend/.venv' --exclude='backend/__pycache__' \
    --exclude='backend/uploads/*' --exclude='backend/outputs/*' \
    -czf /tmp/zashitu.tgz .
scp -i <key> /tmp/zashitu.tgz erkobrax@111.88.153.18:/tmp/

# На VM:
cd ~/zashitu
# .env.prod и любые локальные настройки сохранятся в deploy/.env.prod
cp deploy/.env.prod /tmp/env.prod.bak
find . -mindepth 1 -maxdepth 1 ! -name "." -exec rm -rf {} +
tar xzf /tmp/zashitu.tgz
cp /tmp/env.prod.bak deploy/.env.prod
docker compose -p deploy -f deploy/docker-compose.prod.yml --env-file deploy/.env.prod up -d --build
```

Альтернатива (когда заведём git на VM): `git pull && docker compose ... up -d --build`.

---

## Конфигурация (`deploy/.env.prod`)

Единый env для всех контейнеров (бот + бэкенд + воркер):

| Переменная | Назначение |
|---|---|
| `BOT_TOKEN` | токен от @BotFather |
| `BACKEND_URL` | `http://backend:8000` (DNS внутри `deploy_default`) |
| `BACKEND_INTERNAL_SECRET` + `BOT_INTERNAL_SECRET` | **одинаковое значение**, заголовок `X-Bot-Secret` |
| `TELEGRAM_API_SERVER` | URL Cloudflare Worker |
| `POSTGRES_PASSWORD` | пароль postgres (используется и контейнером, и в `DATABASE_URL`) |
| `DATABASE_URL` | `postgresql+asyncpg://zashitu:${POSTGRES_PASSWORD}@postgres:5432/zashitu_db` |
| `REDIS_URL` / `CELERY_*` | `redis://redis:6379/0` |
| `SECRET_KEY` | JWT-секрет (32 байта hex) |
| `ALLOWED_HOSTS` | `tezis.111.88.153.18.nip.io,backend,localhost` — **обязательно включить `backend`**, иначе бот получит 400 Invalid host header |
| `FRONTEND_URL` | `https://tezis.111.88.153.18.nip.io` |
| `ANTHROPIC_API_KEY` | опционально — пусто = mock-генерация |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | опционально — пусто = `/payments/checkout` → 503 |
| `GENERATION_MODE` | `mock` или `real` |
| `DEV_MODE` | `True` пока Stripe не подключён (доступны `/dev/*` эндпоинты для симуляции оплаты) |
| `COOKIE_SECURE` / `COOKIE_SAMESITE` | `True` / `lax` на HTTPS |

---

## Диагностика

Бот не отвечает в Telegram:
```bash
docker compose -p deploy -f deploy/docker-compose.prod.yml logs --tail=50 bot
# Ожидаемо: "Run polling for bot @ai_presentations_test_bot"

# Telegram видит бота?
source deploy/.env.prod
curl -s "${TELEGRAM_API_SERVER}/bot${BOT_TOKEN}/getMe"
curl -s "${TELEGRAM_API_SERVER}/bot${BOT_TOKEN}/getWebhookInfo"
# webhook.url должен быть пустой (иначе polling конфликтует)
```

Бот ↔ бэкенд связность:
```bash
SECRET=$(grep '^BACKEND_INTERNAL_SECRET=' deploy/.env.prod | cut -d= -f2-)
docker exec deploy-bot-1 python -c "
import httpx
r = httpx.get('http://backend:8000/orders/', headers={'X-Bot-Secret': '${SECRET}'})
print(r.status_code, r.text[:100])
"
# Должно быть 200 [] (пустой список заказов) либо реальные заказы.
```

Веб доступен:
```bash
curl -sI https://tezis.111.88.153.18.nip.io
# HTTP/2 200
```

Postgres жив и данные на месте:
```bash
docker exec deploy-postgres-1 psql -U zashitu -d zashitu_db -c "SELECT count(*) FROM users;"
```

---

## История: дубликат на ATP-VM

Ранее по ошибке развёрнут дубликат стека на `erkobrax@111.88.151.109` (та же машина, что у `tg_bot_ATP`). Снесён полностью (`docker compose down -v`, `rm -rf ~/zashitu`). На ATP-VM снова только ATP. Не путать.

---

## Cloudflare Worker

`cloudflare-worker.js` + `wrangler.toml` — прокси `api.telegram.org`, переиспользуем Worker от ATP. Деплой (один раз был):
```bash
npm install -g wrangler
wrangler login
cd <корень-монорепы>
wrangler deploy       # деплоит cloudflare-worker.js
```

---

## Стоимость

| Ресурс | ₽/мес |
|---|---|
| VM (4–6 ГБ RAM под стек с LibreOffice + Node, не прерываемая) | 600–1000 |
| Диск 20–30 ГБ HDD | 50 |
| Публичный IP | 150 |
| Cloudflare Worker | 0 (бесплатный тариф) |
| **Итого** | **~800–1200 ₽/мес** |

Prerequisite: Anthropic + Stripe оплачиваются отдельно по usage.
