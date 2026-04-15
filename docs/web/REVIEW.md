# Code Review — ZaShitu Web

Дата: 2026-04-14. Всего 60 пунктов. Phase 1 закрывает CRITICAL.
Подробный план фаз — см. `ROADMAP.md`.

## CRITICAL (7)

1. `backend/auth/router.py:40` — cookies `secure=False` в проде → MITM.
2. `backend/payments/router.py:66-96` — нет идемпотентности Stripe webhook, дубль события → двойная генерация.
3. `backend/main.py:41-44` + `dev_router.py` — `/dev/complete-payment/{id}` без авторизации.
4. `backend/config.py:11` — `SECRET_KEY='change_me_in_production'` дефолтом.
5. `backend/generation/tasks.py:17-27, 60-70` — хрупкая строковая замена `+asyncpg→+psycopg2`, bare `except` проглатывает ошибки.
6. `backend/database.py:45` — ALTER TABLE через f-string (сейчас hardcoded, но архитектурно уязвимо).
7. `backend/auth/service.py` — отсутствует защита от брутфорса логина.

## HIGH (11)

8. `backend/files/router.py:37-42` — MIME проверяется только по `Content-Type`, без magic bytes.
9. `backend/files/router.py:104` — имя файла при скачивании может стать пустым после фильтрации.
10. `backend/generation/tasks.py:141-146` — subprocess ошибки без stderr контекста.
11. `backend/payments/router.py:77-78` — все Stripe-ошибки → 400 (нет retry для временных).
12. `backend/payments/service.py` — нет проверки пустого `STRIPE_SECRET_KEY`.
13. `frontend/src/api/client.js:24-48` — refresh-token queue ломается на concurrent 401.
14. `frontend/src/store/index.js:20-60` — persist сохраняет `orderId`/`currentStep` → orphan заказы.
15. `backend/orders/router.py:126` — сравнение `OrderStatus enum` со строкой.
16. `backend/models.py` — нет индексов на `user_id`, `stripe_session_id`, `stripe_payment_intent`.
17. `frontend/src/pages/Payment.jsx:10` — `VITE_DEV_MODE` не синхронизирован с бэкендом.
18. `backend/generation/router.py:21-27` — при ошибке парсинга JSON возвращается raw-строка.

## MEDIUM (22)

19. `backend/generation/tasks.py:244-309` — нет валидации Claude API response (нужна Pydantic schema).
20. `backend/generation/tasks.py:154-178` — zipfile patching без защиты от path traversal.
21. `frontend/src/hooks/index.js:5-15` — `queryClient.removeQueries(['auth','me'])` при logout.
22. `backend/generation/tasks.py:300` — `json.loads` без try/except на невалидный UTF-8.
23. `backend/orders/service.py:10-34` — `required_elements` не валидируется как JSON/список.
24. `frontend/src/components/wizard/Wizard.jsx` — не очищает uploaded_files при reset визарда.
25. `frontend/src/pages/Generation.jsx:56` — `refetchInterval=3s` без backoff.
26. `backend/files/router.py:57-65` — race condition при удалении старого файла.
27. `backend/generation/tasks.py:31` — `max_retries=2` без exponential backoff.
28. `backend/auth/router.py:33-49` — нет fallback на Authorization header.
29. `frontend/src/components/layout/Navbar.jsx:13` — bare `catch{}` при logout.
30. `backend/generation/tasks.py:88` — молчаливый fallback при отсутствии `zashitu_path`.
31. `frontend/src/store/index.js:56-58` — `persist` key без версии/user scope.
32. `backend/models.py:56-61` — `OrderStatus` enum vs string непоследовательно.
33. `frontend/src/pages/Dashboard.jsx:71` — loading без `role="status" aria-live="polite"`.
34. `backend/generation/tasks.py:210-215` — hardcoded skeleton, нет кастомизации.
35. `backend/celery_app.py:18` — нет `task_soft_time_limit`.
36. `backend/database.py:19-21` — нет middleware-гарантии cleanup сессии.
37. `backend/auth/service.py:16-21` — bcrypt без явного `encoding='utf-8'`.
38. `backend/generation/tasks.py:248` — `anthropic.Anthropic()` в каждом вызове (не singleton).
39. `backend/generation/tasks.py:295-298` — парсинг markdown-блоков Claude хрупкий.
40. `backend/payments/router.py:80` — `event["data"]["object"]` без `.get()`.

## LOW (20)

41. Нет тестов на expiration токенов.
42. `GENERATING_MESSAGES` hardcoded (нет i18n).
43. `MAX_FILE_SIZE` не в settings.
44. `ParticleBackground` — нет canvas feature detection.
45. `subprocess` locale на Windows (кодировка).
46. `Login.jsx` — нет обработки network error.
47. `Dashboard.jsx:159` — удаление заказа без confirmation.
48. `backend/files/router.py:107-110` — TOCTOU на `FileResponse`.
49. Step-компоненты визарда — несогласованный UX ошибок валидации.
50. `backend/main.py:25-33` — CORS без fallback/валидации.
51. `Generation.jsx` — clipboard write без try/catch.
52. `backend/generation/tasks.py:106` — нет Pydantic model для финального плана.
53. `frontend/src/store/index.js:39-54` — `getFormData()` не фильтрует undefined.
54. `frontend/src/pages/Payment.jsx:54` — нет валидации UUID на фронте.
55. `frontend/src/components/ui/ParticleBackground.jsx` — фиолетовый хардкод (fix в Phase 4).
56. Нет `aria-label` на декоративных иконках местами.
57. Нет централизованного error boundary на фронте.
58. `backend/files/router.py:23` — `MAX_FILE_SIZE` хардкод 20MB.
59. Нет CSP/SecurityHeaders middleware.
60. Нет структурированного логирования (JSON logs).
