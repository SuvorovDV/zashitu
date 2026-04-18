# Tezis generation benchmark

Перед/после сравнение качества генерации слайдов при изменениях в промптах и рендере.

## Протокол

1. Fixture = каталог в `bench/fixtures/<name>/` с двумя файлами:
   - `speech.md` — текст выступления (симулирует уже утверждённую речь)
   - `order.json` — параметры wizard (topic, thesis, tier, palette, и т.д.)

2. Runner `scripts/bench_gen.py` (запускается внутри `deploy-worker-1`):
   - Читает fixture, seeds speech в Order, вызывает `_pptxgenjs_generator`
   - Пропускает шаг генерации речи (1 Claude call вместо 2) — бюджет бенчмарка тратим только на слайды
   - Сохраняет `deck.pptx` + `summary.json` (layouts, source_ref coverage, titles, stop_reason)

3. Рендер в PNG через LibreOffice + pdftoppm (уже есть в worker image).

4. Evaluation — 6-мерный rubric через Claude Code session (не тратит API-ключ user'а).

## Запуск бенчмарка (VM)

```bash
# с локальной машины
scp -r bench/fixtures/<name> scripts/bench_gen.py root@176.12.79.36:/tmp/
ssh root@176.12.79.36 "
  docker cp /tmp/<name> deploy-worker-1:/tmp/
  docker cp /tmp/bench_gen.py deploy-worker-1:/tmp/
  docker exec deploy-worker-1 python /tmp/bench_gen.py /tmp/<name> /tmp/out
  docker exec deploy-worker-1 bash -c 'cd /tmp/out && libreoffice --headless --convert-to pdf deck.pptx && pdftoppm -r 110 deck.pdf slide -png'
  docker cp deploy-worker-1:/tmp/out /tmp/<name>_out
"
scp -r root@176.12.79.36:/tmp/<name>_out/* bench/<baseline_or_after>/
```

## Бюджет

1 run на sonnet-4-6 ≈ $0.10 (input ~6.5k, output ~5k).

## Фикстуры

- **smb_digital** — «Цифровизация малого и среднего бизнеса в России 2020–2024». Курсовая ВШЭ, 12 мин, 14 слайдов. Источник богат на цифры/таблицы/именованные сущности.
