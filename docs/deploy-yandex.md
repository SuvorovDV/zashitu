# Деплой ZaShitu-бота на Yandex Cloud (Compute Cloud + Docker)

Минимальная VM с Ubuntu, на ней `docker compose up -d`. Бот — один контейнер,
тянет `BACKEND_URL` (zashitu-web) и `BOT_TOKEN`. БД не нужна — сессии
в памяти.

## 1. Создать VM

Compute Cloud → Создать ВМ:

| Параметр | Значение |
|---|---|
| Имя | `zashitu-bot` |
| Платформа | Intel Cascade Lake |
| vCPU | 2, гарантированная доля 20% |
| RAM | 1–2 ГБ |
| Диск | 10 ГБ HDD |
| Образ | Ubuntu 22.04 LTS |
| Сеть | `default`, публичный IPv4 |
| SSH-ключ | свой |
| Прерываемая | ✅ да (~150₽/мес) |

## 2. Поставить Docker

```bash
ssh -i ~/.ssh/yc_key yc-user@<ip>

sudo apt update
sudo apt install -y docker.io docker-compose-plugin git
sudo usermod -aG docker $USER
exit
ssh -i ~/.ssh/yc_key yc-user@<ip>
```

## 3. Развернуть

```bash
git clone <repo-url> zashitu
cd zashitu
cp .env.example .env
nano .env   # заполнить BOT_TOKEN, BACKEND_URL, BACKEND_INTERNAL_SECRET
docker compose up -d --build
docker compose logs -f bot
```

Должно быть `ZaShitu bot starting...`.

## 4. Cloudflare Worker — прокси к Telegram

С российских IP `api.telegram.org` блокируется. Поднимаем 10-строчный
Worker как прозрачный прокси. Бесплатно.

```bash
# на вашем ПК (не на ВМ)
npm install -g wrangler
wrangler login
cd <папка-проекта> && wrangler deploy
# выведет: https://zashitu-tg-proxy.<account>.workers.dev
```

Добавить в `.env` на ВМ:

```bash
echo 'TELEGRAM_API_SERVER=https://zashitu-tg-proxy.<account>.workers.dev' >> .env
docker compose up -d --build
```

## Управление

```bash
docker compose logs -f bot
docker compose restart bot
git pull && docker compose up -d --build
```

## Альтернатива: Railway

В корне есть `railway.json`. Подключите репо на railway.app, задайте
переменные (`BOT_TOKEN`, `BACKEND_URL`, `BACKEND_INTERNAL_SECRET`) —
сборка из `Dockerfile` поднимется автоматически. Прокси не нужен.
