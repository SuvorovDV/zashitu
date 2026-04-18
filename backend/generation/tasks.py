"""Celery-задачи генерации.

Для include_speech=False весь флоу — одна задача generate_slides_task:
сразу строим и сохраняем .pptx.

Для include_speech=True — двухэтапный approval:
  1) generate_speech_task → speech_text, status=awaiting_review
  2) пользователь approves или регенерирует (до 10 раз)
  3) generate_slides_task → output_filename, status=awaiting_review
  4) пользователь approves или регенерирует (до 5 раз) → status=done
"""
import base64
import json
import os
import re
import subprocess
import sys
import uuid
import logging
import zipfile
from pathlib import Path
from typing import List, Optional, Union

from pydantic import BaseModel, Field, ValidationError

from celery_app import celery
from config import settings, TIERS

logger = logging.getLogger(__name__)

_PPTXGEN_SCRIPT = Path(__file__).parent / "pptxgen.js"

# ── Anthropic singleton ──────────────────────────────────────────────────────

_anthropic_client = None


def _get_anthropic_client():
    global _anthropic_client
    if _anthropic_client is None:
        import anthropic
        _anthropic_client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    return _anthropic_client


def _messages_kwargs(**kw):
    """client.messages.create kwargs, отфильтрованные под конкретную модель.
    Opus 4.7 не поддерживает temperature — для него параметр выкидываем."""
    if "opus-4-7" in (kw.get("model") or ""):
        kw.pop("temperature", None)
    return kw


class SlideColumn(BaseModel):
    heading: str = ""
    bullets: List[str] = Field(default_factory=list)


class StatItem(BaseModel):
    value: str = ""     # Короткая цифра/единица: «80%», «12 мин», «3×»
    label: str = ""     # Подпись снизу


class ChartSeries(BaseModel):
    name: str = ""
    data: List[float] = Field(default_factory=list)


# Layouts Claude МОЖЕТ переопределить из контента (если данные располагают к таблице/графику).
# section/callout/quote/stats/image_* остаются закреплёнными за скелетом.
OVERRIDABLE_LAYOUTS = {"table", "chart"}


class SlideContent(BaseModel):
    # Claude может переопределить layout, если хочет table/chart вместо default/two_col.
    layout: Optional[str] = None
    bullets: Optional[List[str]] = None
    callout: Optional[str] = None
    columns: Optional[List[SlideColumn]] = None
    subtitle: Optional[str] = None
    # Layout=quote — центрированная цитата.
    quote: Optional[str] = None
    attribution: Optional[str] = None
    # Layout=stats — ряд из «числа + подпись».
    stats: Optional[List[StatItem]] = None
    intro: Optional[str] = None
    # Layout=image_side — bullets справа/слева от иллюстрации.
    side: Optional[str] = None  # "left" | "right"
    # Промт для генерации иллюстрации. СТРОГО без текста/надписей.
    # Отключается для ВКР/дипломной защиты.
    image_prompt: Optional[str] = None
    # После генерации — относительный путь к картинке в OUTPUT_DIR.
    image_path: Optional[str] = None
    # Layout=table — табличные данные.
    headers: Optional[List[str]] = None
    rows: Optional[List[List[str]]] = None
    # Layout=chart — нативный PPTX-график.
    chart_type: Optional[str] = None  # "bar" | "line" | "pie"
    labels: Optional[List[str]] = None
    series: Optional[List[ChartSeries]] = None
    # Ссылка на источник — обязательна на всех content-слайдах (кроме section).
    # Форматы: «с. 47», «с. 47–49», «Росстат, с. 12», «источник: загруженная работа».
    source_ref: Optional[str] = None


# ── Описания палитр для Claude (чтобы контент попадал в визуальную тональность) ───
PALETTE_MOODS = {
    "midnight_executive": "глубокий синий, строгая корпоративная атмосфера, уверенность",
    "forest_moss":        "зелёный, экологичный и спокойный, природа и рост",
    "coral_energy":       "коралловый, энергичный, современный, маркетинг/стартап",
    "warm_terracotta":    "тёплый терракот, уютно-гуманитарный, история/культура",
    "ocean_gradient":     "морской синий градиент, технологичный, IT/дата",
    "charcoal_minimal":   "угольно-чёрный, минимализм, архитектура/дизайн",
    "teal_trust":         "бирюзовый, доверие, медицина/финансы",
    "berry_cream":        "бордово-кремовый, мягкий, литература/гуманитарные",
    "sage_calm":          "мятный, спокойный и аналитичный, научные данные",
    "cherry_bold":        "тёмно-красный, драматический, политика/социология",
}

# Хекс-пары (primary, accent) по палитре — для SVG-промптов.
# Должны совпадать с PALETTES в pptxgen.js — меняй синхронно.
PALETTE_COLORS = {
    "midnight_executive": ("#1E2761", "#CADCFC"),
    "forest_moss":        ("#2C5F2D", "#97BC62"),
    "coral_energy":       ("#F96167", "#2F3C7E"),
    "warm_terracotta":    ("#B85042", "#A7BEAE"),
    "ocean_gradient":     ("#065A82", "#1C7293"),
    "charcoal_minimal":   ("#36454F", "#212121"),
    "teal_trust":         ("#028090", "#02C39A"),
    "berry_cream":        ("#6D2E46", "#A26769"),
    "sage_calm":          ("#50808E", "#84B59F"),
    "cherry_bold":        ("#990011", "#2F3C7E"),
}

# ── Плотность текста в зависимости от уровня детализации ─────────────────────
DETAIL_DIRECTIVES = {
    "brief":    "2–3 буллета на слайде, короткие (до 10 слов). Телеграфный стиль.",
    "standard": "3–5 буллетов на слайде, по 1–2 предложения. Баланс содержания и лаконичности.",
    "detailed": "4–6 буллетов на слайде, полные предложения с конкретикой (числа, примеры, "
                "названия методов). Можно добавлять пояснения к тезисам.",
}

# ── Типы работ → тональность слайдов ─────────────────────────────────────────
WORK_TYPE_TONE = {
    "ВКР":              "академический, строгий. Никаких лишних эмоций и шуток.",
    "Курсовая":         "академический, но более живой. Можно лёгкие эмоциональные акценты.",
    "Школьный реферат": "простой и понятный, подходит подростку-старшекласснику.",
    "Семинар":          "дискуссионный. Структура призвана вести к обсуждению.",
    "Обычный доклад":   "нейтрально-деловой, информативный. Без академической чопорности, но и без product-demo.",
    "Личный проект":    "уверенная продуктовая, product-demo от первого лица. Живо, без канцелярита.",
}


def _sync_database_url() -> str:
    url = settings.DATABASE_URL
    if "+asyncpg" in url:
        return url.replace("+asyncpg", "+psycopg2")
    if "+aiosqlite" in url:
        return url.replace("+aiosqlite", "")
    return url


def _get_sync_db():
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    engine = create_engine(_sync_database_url())
    Session = sessionmaker(bind=engine)
    return Session()


def _mark_failed(db, order_id: str, exc: Exception):
    from models import Order, OrderStatus
    try:
        order = db.query(Order).filter(Order.id == order_id).first()
        if order:
            order.status = OrderStatus.failed.value
            order.error_message = str(exc)[:2000]
            db.commit()
    except Exception:
        logger.exception("Failed to mark order as failed")


# ── Task: генерация текста выступления ───────────────────────────────────────


@celery.task(bind=True, max_retries=2, default_retry_delay=30, retry_backoff=True)
def generate_speech_task(self, order_id: str):
    db = _get_sync_db()
    try:
        from models import Order, OrderStatus
        order = db.query(Order).filter(Order.id == order_id).first()
        if not order:
            logger.error(f"Order {order_id} not found")
            return

        order.status = OrderStatus.generating.value
        db.commit()

        # Короткое замыкание: юзер уже принёс готовый текст речи → пропускаем Claude-генерацию,
        # копируем его текст как финальный и сразу авто-апрувим. Экономит $ и уважает намерение юзера.
        if getattr(order, "speech_is_user_provided", False) and (order.user_speech_text or "").strip():
            order.speech_text = order.user_speech_text.strip()[:40000]
            order.speech_prompt = json.dumps(
                {"mode": "user_provided", "chars": len(order.speech_text), "raw_response": None},
                ensure_ascii=False, indent=2,
            )
            order.speech_revision_note = None
            order.speech_approved = True
            order.status = OrderStatus.generating.value
            db.commit()
            logger.info(f"Order {order_id} speech copied from user input ({len(order.speech_text)} chars), skipping Claude")
            # Запускаем следующий этап — слайды — сразу, не ждём approval UI.
            generate_slides_task.delay(order_id)
            return

        tier_config = TIERS.get(order.tier, TIERS["basic"])
        text, prompt_record = _generate_speech(order, tier_config)

        order.speech_text = text
        order.speech_prompt = json.dumps(prompt_record, ensure_ascii=False, indent=2)
        # Заметка пользователя использована — очищаем, чтобы не влияла на будущие прогоны.
        order.speech_revision_note = None
        order.status = OrderStatus.awaiting_review.value
        db.commit()
        logger.info(f"Order {order_id} speech ready (revision={order.speech_revisions})")
    except Exception as exc:
        logger.exception(f"Speech generation failed for {order_id}: {exc}")
        _mark_failed(db, order_id, exc)
        raise self.retry(exc=exc)
    finally:
        db.close()


# ── Task: генерация слайдов (.pptx) ──────────────────────────────────────────


@celery.task(bind=True, max_retries=2, default_retry_delay=30, retry_backoff=True)
def generate_slides_task(self, order_id: str):
    db = _get_sync_db()
    try:
        from models import Order, UploadedFile, OrderStatus

        order = db.query(Order).filter(Order.id == order_id).first()
        if not order:
            logger.error(f"Order {order_id} not found")
            return

        order.status = OrderStatus.generating.value
        db.commit()

        uploaded_file = db.query(UploadedFile).filter(UploadedFile.order_id == order_id).first()
        file_path: Optional[Path] = None
        if uploaded_file:
            fp = Path(settings.UPLOAD_DIR) / uploaded_file.stored_filename
            if fp.exists():
                file_path = fp

        tier_config = TIERS.get(order.tier, TIERS["basic"])
        output_filename, generation_prompt = _pptxgenjs_generator(order, file_path, tier_config)

        # Рендерим pixel-perfect PNG-превью каждого слайда через LibreOffice.
        preview_count = 0
        try:
            preview_count = _render_preview(Path(settings.OUTPUT_DIR) / output_filename)
        except Exception as e:
            logger.warning(f"Preview render failed for {order_id}: {e}")

        order.output_filename = output_filename
        order.generation_prompt = generation_prompt
        order.preview_count = preview_count
        order.slides_revision_note = None  # использована, очищаем

        if order.include_speech:
            # Второй approval-этап: ждём, когда юзер примет слайды.
            order.status = OrderStatus.awaiting_review.value
        else:
            # Без speech — слайды сразу финальны.
            order.slides_approved = True
            order.status = OrderStatus.done.value

        db.commit()
        logger.info(
            f"Order {order_id} slides ready (revision={order.slides_revisions}, "
            f"auto_approved={not order.include_speech})"
        )
    except Exception as exc:
        logger.exception(f"Slides generation failed for {order_id}: {exc}")
        _mark_failed(db, order_id, exc)
        raise self.retry(exc=exc)
    finally:
        db.close()


# ── Диспетчер, выбирающий с какого этапа стартовать ──────────────────────────


@celery.task(name="generation.tasks.start_generation")
def start_generation_task(order_id: str):
    db = _get_sync_db()
    try:
        from models import Order
        order = db.query(Order).filter(Order.id == order_id).first()
        if not order:
            logger.error(f"Order {order_id} not found")
            return
        if order.include_speech:
            generate_speech_task.delay(order_id)
        else:
            generate_slides_task.delay(order_id)
    finally:
        db.close()


# Оставляем имя generate_presentation_task для обратной совместимости с webhook.
generate_presentation_task = start_generation_task


# ── pptxgenjs generator ──────────────────────────────────────────────────────


def _pptxgenjs_generator(order, file_path, tier_config):
    Path(settings.OUTPUT_DIR).mkdir(parents=True, exist_ok=True)
    output_filename = f"{uuid.uuid4()}.pptx"
    output_path = (Path(settings.OUTPUT_DIR) / output_filename).resolve()

    skeleton = _build_skeleton(order, tier_config)

    # Всегда строим Claude-промт для технической панели — даже если реального API нет.
    sys_p, usr_p = _build_slides_prompts(order, skeleton)
    model = tier_config.get("model", "claude-sonnet-4-6")
    claude_prompt = {
        "system": sys_p,
        "user": usr_p,
        "model": model,
        "temperature": 0.6,
        "max_tokens": 16000,
        "pseudocode": (
            f"import anthropic, json\n"
            f"client = anthropic.Anthropic()\n"
            f"resp = client.messages.create(\n"
            f"    model=\"{model}\",\n"
            f"    max_tokens=16000,\n"
            f"    temperature=0.6,\n"
            f"    system=<system>,\n"
            f"    messages=[{{\"role\": \"user\", \"content\": <user>}}],\n"
            f")\n"
            f"slides = json.loads(resp.content[0].text)\n"
            f"# Для каждого slide['image_prompt']:\n"
            f"# img = openai.images.generate(prompt=slide['image_prompt'], size='1024x1024')"
        ),
        "raw_response": None,
    }

    if settings.ANTHROPIC_API_KEY:
        slide_contents, real_prompt = _generate_with_claude(order, skeleton, tier_config)
        claude_prompt = real_prompt  # содержит raw_response
    else:
        slide_contents, _ = _generate_placeholder(order, skeleton)
        claude_prompt["placeholder_used"] = True

    # Генерируем иллюстрации для слайдов с image_prompt.
    # Backend: OpenAI (если есть ключ) → Claude-SVG (если есть ANTHROPIC_API_KEY) → disabled.
    image_stats = _generate_images_for_slides(
        slide_contents,
        output_path.stem,
        palette_id=(order.palette or "midnight_executive"),
        model=model,
    )
    claude_prompt["image_generation"] = image_stats

    plan = _assemble_plan(order, tier_config, skeleton, slide_contents, str(output_path))

    prompt_record = {
        "mode": "claude" if settings.ANTHROPIC_API_KEY else "placeholder",
        "model": model,
        "claude_prompt": claude_prompt,
        "slide_plan": plan,
    }
    prompt_json = json.dumps(prompt_record, ensure_ascii=False, indent=2)

    plan_json = json.dumps(plan, ensure_ascii=False)
    env = {**os.environ, "PYTHONIOENCODING": "utf-8", "LANG": "C.UTF-8"}
    try:
        result = subprocess.run(
            ["node", str(_PPTXGEN_SCRIPT)],
            input=plan_json.encode("utf-8"),
            capture_output=True,
            cwd=str(_PPTXGEN_SCRIPT.parent),
            env=env,
            timeout=180,
        )
    except FileNotFoundError:
        raise RuntimeError("Node.js не найден — установи node для pptxgenjs генератора")
    except subprocess.TimeoutExpired:
        raise RuntimeError("pptxgen.js таймаут (180s)")

    stderr = result.stderr.decode("utf-8", errors="replace").strip()
    stdout = result.stdout.decode("utf-8", errors="replace").strip()

    if result.returncode != 0:
        raise RuntimeError(
            f"pptxgen.js failed (code {result.returncode}): "
            f"stderr={stderr[:500]!r} stdout={stdout[:500]!r}"
        )

    try:
        out = json.loads(stdout)
    except json.JSONDecodeError:
        raise RuntimeError(f"pptxgen.js non-JSON output: {stdout[:500]!r}")

    if not out.get("ok"):
        raise RuntimeError(f"pptxgen.js returned not ok: {stdout[:500]!r}")

    _fix_cyrillic_charset(output_path)
    return output_filename, prompt_json


_SVG_SCRIPT = Path(__file__).parent / "svg_to_png.js"


def _generate_images_for_slides(
    slide_contents: list, output_stem: str, palette_id: str = "midnight_executive", model: str = "claude-sonnet-4-6"
) -> dict:
    """
    Иллюстрации для слайдов с image_prompt.

    Backend выбирается так:
      • OPENAI_API_KEY задан → OpenAI Images API (фотореализм).
      • иначе если ANTHROPIC_API_KEY задан → Claude генерирует SVG, растеризуем через resvg-js.
      • иначе — disabled.

    Сохраняет PNG в OUTPUT_DIR/{output_stem}_img_{i}.png, заполняет `image_path`.
    """
    requested = sum(1 for s in slide_contents if s.get("image_prompt"))
    stats = {
        "requested": requested,
        "generated": 0,
        "errors": [],
        "backend": None,
        "model": None,
    }
    if not slide_contents or requested == 0:
        stats["disabled_reason"] = "no image_prompt fields in slides"
        return stats

    if settings.OPENAI_API_KEY:
        stats["backend"] = "openai"
        stats["model"] = settings.IMAGE_MODEL
        stats["size"] = settings.IMAGE_SIZE
        _images_via_openai(slide_contents, output_stem, stats)
    elif settings.ANTHROPIC_API_KEY:
        stats["backend"] = "claude-svg"
        stats["model"] = model
        _images_via_claude_svg(slide_contents, output_stem, stats, palette_id, model)
    else:
        stats["disabled_reason"] = "neither OPENAI_API_KEY nor ANTHROPIC_API_KEY is set"

    return stats


def _images_via_openai(slide_contents: list, output_stem: str, stats: dict) -> None:
    try:
        from openai import OpenAI
    except ImportError:
        stats["disabled_reason"] = "openai package not installed"
        return

    neg_suffix = (
        "no text, no words, no letters, no numbers, no captions, "
        "no writing of any kind, clean minimalist composition"
    )
    stats["negative_prompt_suffix"] = neg_suffix

    client = OpenAI(api_key=settings.OPENAI_API_KEY)
    out_dir = Path(settings.OUTPUT_DIR)
    out_dir.mkdir(parents=True, exist_ok=True)

    for i, slide in enumerate(slide_contents):
        prompt = slide.get("image_prompt")
        if not prompt:
            continue
        safe_prompt = f"{prompt}. {neg_suffix}."
        try:
            resp = client.images.generate(
                model=settings.IMAGE_MODEL,
                prompt=safe_prompt,
                size=settings.IMAGE_SIZE,
                n=1,
            )
            data = resp.data[0]
            img_path = Path(settings.OUTPUT_DIR) / f"{output_stem}_img_{i+1}.png"

            if getattr(data, "b64_json", None):
                img_path.write_bytes(base64.b64decode(data.b64_json))
            elif getattr(data, "url", None):
                import urllib.request
                with urllib.request.urlopen(data.url, timeout=60) as r:
                    img_path.write_bytes(r.read())
            else:
                raise RuntimeError("OpenAI response has neither b64_json nor url")

            slide["image_path"] = str(img_path)
            stats["generated"] += 1
            logger.info(f"Generated OpenAI image {i+1} for {output_stem}")
        except Exception as e:
            logger.warning(f"OpenAI image {i+1} failed: {e}")
            stats["errors"].append({"index": i + 1, "error": str(e)[:300]})
            slide.pop("image_path", None)


def _images_via_claude_svg(
    slide_contents: list, output_stem: str, stats: dict, palette_id: str, model: str
) -> None:
    """Claude рисует минималистичные SVG в палитре слайда, resvg-js растеризует в PNG."""
    primary, accent = PALETTE_COLORS.get(palette_id, ("#1E2761", "#CADCFC"))
    stats["palette_primary"] = primary
    stats["palette_accent"] = accent

    client = _get_anthropic_client()
    out_dir = Path(settings.OUTPUT_DIR)
    out_dir.mkdir(parents=True, exist_ok=True)

    for i, slide in enumerate(slide_contents):
        prompt = slide.get("image_prompt")
        if not prompt:
            continue

        system_prompt = (
            "Ты создаёшь декоративные SVG-иконки для слайдов презентации. "
            "Это НЕ основная иллюстрация, а небольшой значок-акцент в углу слайда "
            "(финальный размер на слайде ~1.3\"×1.3\", поэтому композиция должна быть "
            "читаемой при малом размере).\n"
            "Возвращаешь ТОЛЬКО валидный SVG — один тег <svg ...>...</svg>, "
            "без markdown-обёрток, без объяснений, без текста ВНУТРИ svg "
            "(никаких <text>, <tspan>, цифр, букв — чистая графика).\n"
            "Размер: viewBox=\"0 0 256 256\", фон прозрачный.\n"
            f"Используй 2–4 цвета из палитры: основной {primary}, акцент {accent}, "
            "плюс белый и нейтральный серый. Яркие чужие цвета не добавляй.\n"
            "Стиль: плоская геометрия — круги, дуги, линии, простые силуэты, "
            "сетки, треугольники. Толщина линий stroke-width от 2 до 6. "
            "Fill и stroke комбинируй сознательно. Не больше 8 фигур в композиции.\n"
            "Смысл: метафора темы слайда, но АБСТРАКТНАЯ — не буквальная иллюстрация. "
            "Избегай лиц, зданий, реалистичных объектов — только знаковая графика."
        )
        user_prompt = f"Нарисуй декоративный SVG-акцент для слайда на тему: {prompt}"
        try:
            resp = client.messages.create(**_messages_kwargs(
                model=model,
                max_tokens=8000,
                temperature=0.5,
                system=system_prompt,
                messages=[{"role": "user", "content": user_prompt}],
            ))
            svg_raw = resp.content[0].text.strip() if resp.content else ""
            svg = _extract_svg(svg_raw)
            if not svg:
                raise RuntimeError(f"no <svg> tag in Claude response (stop={resp.stop_reason})")

            svg_path = out_dir / f"{output_stem}_img_{i+1}.svg"
            png_path = out_dir / f"{output_stem}_img_{i+1}.png"
            svg_path.write_text(svg, encoding="utf-8")

            # 512px — декор на слайде ~1.3"×1.3", этого хватит при любом зуме.
            result = subprocess.run(
                ["node", str(_SVG_SCRIPT), str(svg_path), str(png_path), "512"],
                capture_output=True, text=True, timeout=30,
            )
            if result.returncode != 0 or not png_path.exists():
                raise RuntimeError(
                    f"svg_to_png failed (rc={result.returncode}): {result.stderr.strip()[:300]}"
                )

            slide["image_path"] = str(png_path)
            stats["generated"] += 1
            logger.info(f"Generated Claude-SVG image {i+1} for {output_stem}")
        except Exception as e:
            logger.warning(f"Claude-SVG image {i+1} failed: {e}")
            stats["errors"].append({"index": i + 1, "error": str(e)[:300]})
            slide.pop("image_path", None)


def mark_speech_with_slide_boundaries(speech_text: str, slide_titles: list) -> str:
    """Вставляет маркеры «=== Слайд N: title ===» в текст выступления, привязывая
    абзацы к слайдам. Используется при скачивании speech.md из дашборда.

    Если ключа Claude нет или модель вернула мусор — возвращаем исходный текст.
    """
    if not speech_text or not slide_titles or not settings.ANTHROPIC_API_KEY:
        return speech_text

    titles_list = "\n".join(f"{i+1}. {t}" for i, t in enumerate(slide_titles))
    system_prompt = (
        "Ты разметчик текста выступления под слайды. На вход: текст речи в markdown "
        "и упорядоченный список заголовков слайдов. Задача: вставить ПЕРЕД каждым "
        "фрагментом речи строку вида «=== Слайд N: {title} ===» на отдельной строке "
        "(с пустой строкой до и после). Один слайд может покрывать один или несколько "
        "подряд идущих абзацев. Не меняй текст, не перефразируй, не добавляй ничего "
        "своего — ТОЛЬКО вставка маркеров.\n\n"
        "Если для какого-то слайда в речи нет явного материала — всё равно вставь "
        "маркер, но без текста под ним (следующий маркер пойдёт сразу). "
        "Если в речи есть # Вступление / # Основная часть / # Заключение — оставь "
        "их как есть, маркеры слайдов ставь ВНУТРИ этих секций.\n\n"
        "Возвращай ТОЛЬКО размеченный markdown, без объяснений и без обёрток ```."
    )
    user_prompt = (
        f"Слайды (в том порядке, в котором появляются в презентации):\n{titles_list}\n\n"
        f"Текст выступления:\n\n{speech_text}"
    )

    try:
        client = _get_anthropic_client()
        resp = client.messages.create(**_messages_kwargs(
            model="claude-sonnet-4-6",  # дешёвая модель — это простая разметка
            max_tokens=16000,
            temperature=0.2,
            system=system_prompt,
            messages=[{"role": "user", "content": user_prompt}],
        ))
        marked = resp.content[0].text.strip() if resp.content else ""
        # Срезаем markdown-обёртку ```markdown ... ```, если вдруг пришла.
        if marked.startswith("```"):
            parts = marked.split("```")
            if len(parts) >= 3:
                inner = parts[1]
                if "\n" in inner:
                    inner = inner.split("\n", 1)[1]
                marked = inner.strip()
        # Базовая валидация — должна хотя бы один маркер появиться.
        if "=== Слайд" not in marked:
            logger.warning("mark_speech: no markers in response, returning original")
            return speech_text
        return marked
    except Exception as e:
        logger.warning(f"mark_speech failed: {e}; returning original")
        return speech_text


def _extract_svg(raw: str) -> str:
    """Достаёт тег <svg ...>...</svg> из ответа Claude, срезая markdown-обёртки."""
    if not raw:
        return ""
    s = raw.strip()
    if s.startswith("```"):
        parts = s.split("```")
        if len(parts) >= 3:
            inner = parts[1]
            if "\n" in inner:
                inner = inner.split("\n", 1)[1]
            s = inner.strip()
    m = re.search(r"<svg\b[^>]*>.*?</svg>", s, flags=re.DOTALL | re.IGNORECASE)
    return m.group(0) if m else ""


def _render_preview(pptx_path: Path) -> int:
    """
    Конвертит .pptx → PDF (LibreOffice headless) → PNG-страницы (pdftoppm).
    Превью ложатся рядом с исходником: {stem}-01.png, {stem}-02.png и т.д.
    Возвращает количество созданных страниц.
    """
    pptx_path = Path(pptx_path)
    work_dir = pptx_path.parent
    stem = pptx_path.stem

    # 1) pptx → pdf. LibreOffice долго стартует первый раз, задаём таймаут 3 мин.
    lo_env = {
        **os.environ,
        "HOME": "/tmp",  # LibreOffice нужна пишущая $HOME для профиля
    }
    result = subprocess.run(
        ["libreoffice", "--headless", "--nologo", "--convert-to", "pdf",
         "--outdir", str(work_dir), str(pptx_path)],
        capture_output=True,
        timeout=180,
        env=lo_env,
    )
    if result.returncode != 0:
        raise RuntimeError(
            f"libreoffice failed ({result.returncode}): "
            f"{result.stderr.decode('utf-8', errors='replace')[:500]!r}"
        )

    pdf_path = work_dir / f"{stem}.pdf"
    if not pdf_path.exists():
        raise RuntimeError(f"libreoffice produced no PDF at {pdf_path}")

    # 2) pdf → PNGs. 110 DPI → ~1280×720 слайд, баланс между чёткостью и весом.
    prefix = work_dir / stem
    result = subprocess.run(
        ["pdftoppm", "-png", "-r", "110", str(pdf_path), str(prefix)],
        capture_output=True,
        timeout=120,
    )
    if result.returncode != 0:
        raise RuntimeError(
            f"pdftoppm failed ({result.returncode}): "
            f"{result.stderr.decode('utf-8', errors='replace')[:500]!r}"
        )

    # Удаляем промежуточный PDF — пользователь его не скачивает.
    try:
        pdf_path.unlink(missing_ok=True)
    except OSError:
        pass

    pages = sorted(work_dir.glob(f"{stem}-*.png"))
    logger.info(f"Rendered {len(pages)} preview pages for {stem}")
    return len(pages)


def _fix_cyrillic_charset(pptx_path: Union[str, Path]):
    pptx_path = Path(pptx_path)
    tmp = pptx_path.with_suffix(pptx_path.suffix + ".fix.tmp")
    with zipfile.ZipFile(pptx_path, "r") as zin, \
         zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            name = item.filename
            if name.startswith("/") or ".." in Path(name).parts:
                logger.warning(f"Skipping suspicious zip entry: {name!r}")
                continue
            data = zin.read(item.filename)
            if name.endswith(".xml"):
                xml = data.decode("utf-8", errors="replace")
                xml = re.sub(
                    r'(<a:(?:latin|ea|cs)\s[^>]*?)charset="0"',
                    r'\1charset="204"',
                    xml,
                )
                data = xml.encode("utf-8")
            zout.writestr(item, data)
    os.replace(tmp, pptx_path)


_ALLOWED_SKELETON_LAYOUTS = {
    "default", "callout", "two_col", "section", "quote", "stats", "table", "chart",
}


def _derive_skeleton_from_speech(order, n_slides: int, tier_config: dict) -> list:
    """Просит Claude предложить skeleton из n слайдов по структуре утверждённой речи.

    Возвращает [{"name": str, "layout": str}, ...] длиной ровно n, либо пустой список
    при любой ошибке — тогда вызывающий откатится на фиксированный пул.
    """
    speech_text = order.speech_text or ""
    if not speech_text:
        return []

    allow_images = (order.work_type or "").strip() not in ("ВКР",)
    detail = order.detail_level or "standard"
    work_type = order.work_type or "—"

    system_prompt = f"""Ты проектировщик структуры академической презентации.
Вход: утверждённый ТЕКСТ ВЫСТУПЛЕНИЯ в markdown.
Задача: предложить skeleton презентации из РОВНО {n_slides} слайдов,
чьи заголовки ТОЧНО соответствуют логическим шагам речи в том же порядке.

Доступные layouts (крупные image-слайды не используй):
- default — 3–6 bullets
- callout — акцентная фраза + поддерживающие bullets
- two_col — две колонки сравнения
- section — разделитель блоков (заголовок большой главы)
- quote — цитата
- stats — 3–4 больших числа с подписями
- table — табличные данные (если в речи есть markdown-таблица)
- chart — график (если в речи есть числовой ряд по годам или категориям)

Жёсткие правила:
1. Первый слайд — введение, default или callout.
2. Последний слайд — выводы, default/callout/quote (НЕ section, НЕ stats).
3. Если в речи есть # заголовок первого уровня — он становится section-слайдом.
4. Каждая markdown-таблица в речи → один слайд с layout=table.
5. Каждый числовой ряд по времени/категориям → layout=chart.
6. Выразительные цитаты в кавычках → layout=quote (не обязательно, но желательно 1 на колоду).
7. Плотность: detail={detail} — при brief можно длиннее каждый слайд, при detailed — дробнее.
8. Тип работы: {work_type} — не используй слова «ВКР/диплом», если это не ВКР.
9. Названия слайдов — короткие (≤60 символов), без номеров, отражают содержимое конкретного фрагмента речи.
10. НЕ выдумывай темы, которых нет в речи. Если речь короткая — сгруппируй иначе, но {n_slides} ровно.

Верни ТОЛЬКО JSON-массив ровно из {n_slides} объектов вида
{{"name": "...", "layout": "..."}} — без markdown-обёрток, без объяснений."""

    user_prompt = (
        f"ТЕКСТ ВЫСТУПЛЕНИЯ:\n```markdown\n{speech_text[:40000]}\n```\n\n"
        f"Верни JSON-массив из {n_slides} слайдов."
    )

    client = _get_anthropic_client()
    model = tier_config.get("model", "claude-sonnet-4-6")
    resp = client.messages.create(**_messages_kwargs(
        model=model,
        max_tokens=4000,
        temperature=0.3,
        system=system_prompt,
        messages=[{"role": "user", "content": user_prompt}],
    ))
    raw = resp.content[0].text.strip() if resp.content else ""
    if raw.startswith("```"):
        parts = raw.split("```")
        if len(parts) >= 3:
            inner = parts[1]
            if "\n" in inner:
                inner = inner.split("\n", 1)[1]
            raw = inner.strip()

    parsed = json.loads(raw)
    if not isinstance(parsed, list):
        return []

    result = []
    for item in parsed:
        if not isinstance(item, dict):
            continue
        name = str(item.get("name") or "").strip()[:80]
        layout = str(item.get("layout") or "default").strip()
        if not name:
            continue
        if layout not in _ALLOWED_SKELETON_LAYOUTS:
            layout = "default"
        if not allow_images and layout in ("image_side", "image_full"):
            layout = "default"
        result.append({"name": name, "layout": layout})

    if len(result) != n_slides:
        logger.warning(
            f"Speech-derived skeleton returned {len(result)} slides, expected {n_slides}"
        )
        return []
    return result


def _build_skeleton(order, tier_config) -> list:
    # Порядок приоритета определения кол-ва слайдов:
    # 1. slides_count задан явно — используем его (зажато в [6, 40]).
    # 2. Юзер выбрал длительность → считаем ~1.1 слайда в минуту
    #    (стандартный темп академической защиты), зажато в [6, tier_max_slides].
    # 3. Fallback — дефолт тарифа.
    user_count = getattr(order, "slides_count", None)
    duration = getattr(order, "duration_minutes", None)
    tier_max = tier_config.get("max_slides", tier_config.get("slides", 12))

    if user_count and isinstance(user_count, int) and user_count > 0:
        n_slides = max(6, min(40, user_count))
    elif duration and isinstance(duration, int) and duration > 0:
        # 1.1 sl/min: 10 мин → 11 слайдов, 15 → 17, 25 → 28 (отсекается tier_max).
        n_slides = max(6, min(tier_max, round(duration * 1.1)))
    else:
        n_slides = tier_config.get("slides", 12)

    # Если пользователь уже утвердил текст речи — скелет выводим ИЗ РЕЧИ,
    # а не из дефолтного академического пула. Это даёт:
    # (1) Titles слайдов, которые реально соответствуют содержимому спича
    #     → контент-проход не «натягивает» кузбасский анализ на «Цели и задачи»;
    # (2) Маркировка речи при скачивании становится точной (каждый абзац
    #     находит свой заголовок слайда).
    if (
        getattr(order, "include_speech", False)
        and getattr(order, "speech_approved", False)
        and getattr(order, "speech_text", None)
        and settings.ANTHROPIC_API_KEY
    ):
        try:
            derived = _derive_skeleton_from_speech(order, n_slides, tier_config)
            if derived and len(derived) == n_slides:
                logger.info(f"Using speech-derived skeleton for {getattr(order, 'id', '?')}")
                return derived
        except Exception as e:
            logger.warning(f"Speech-derived skeleton failed ({e}), using fixed pool")

    full_pool = [
        {"name": "Введение",                    "layout": "default"},
        {"name": "Актуальность темы",           "layout": "callout"},
        {"name": "Цели и задачи",               "layout": "two_col"},
        {"name": "Степень изученности темы",    "layout": "default"},
        {"name": "Теоретические основы",        "layout": "default"},
        {"name": "Обзор литературы",            "layout": "default"},
        {"name": "Методология исследования",    "layout": "two_col"},
        {"name": "Инструменты и данные",        "layout": "default"},
        {"name": "Анализ данных",               "layout": "default"},
        {"name": "Ключевые результаты",         "layout": "callout"},
        {"name": "Сравнительный анализ",        "layout": "two_col"},
        {"name": "Обсуждение результатов",      "layout": "default"},
        {"name": "Практическая значимость",     "layout": "default"},
        {"name": "Апробация результатов",       "layout": "default"},
        {"name": "Ограничения исследования",    "layout": "default"},
        {"name": "Перспективы развития",        "layout": "default"},
        {"name": "Выводы",                      "layout": "two_col"},
        {"name": "Заключение",                  "layout": "default"},
        {"name": "Список источников",           "layout": "default"},
        {"name": "Список литературы",           "layout": "default"},
        {"name": "Дополнительные материалы",    "layout": "default"},
        {"name": "Приложения",                  "layout": "default"},
    ]

    if n_slides <= 12:
        base = full_pool[:10]
    elif n_slides <= 20:
        base = full_pool[:14]
    else:
        base = full_pool[:18]

    result = []
    for i, s in enumerate(base):
        if n_slides > 12 and i > 0 and i % 6 == 0 and len(result) < n_slides:
            result.append({"name": s["name"], "layout": "section"})
        result.append(s)

    extra_idx = 0
    extra = ["Дополнительный анализ", "Расширенные результаты", "Детализация методов",
             "Сравнительные данные", "Критический анализ", "Перекрёстные ссылки"]
    while len(result) < n_slides:
        result.append({"name": extra[extra_idx % len(extra)], "layout": "default"})
        extra_idx += 1

    # Вариативность: для не-ВКР — разбавляем макеты цитатой и stats. Крупные image-слайды
    # (image_side/image_full) больше НЕ включаем в rotation — SVG-иллюстрации теперь
    # рендерятся как компактные декоративные акценты на обычных слайдах (см. pptxgen.js).
    allow_variety = (order.work_type or "").strip() not in ("ВКР",)
    if allow_variety:
        # Добавляем `quote` ближе к середине, если в дeckе ≥ 12 слайдов.
        if len(result) >= 12:
            mid = len(result) // 2
            # Меняем соседний default на quote, чтобы не раздувать deck.
            for off in (0, 1, -1, 2, -2):
                j = mid + off
                if 0 <= j < len(result) and result[j]["layout"] == "default":
                    result[j] = {"name": result[j]["name"], "layout": "quote"}
                    break

        # Stats — если выбран detailed, один на deck.
        if (order.detail_level or "") == "detailed":
            for i, s in enumerate(result):
                if s["layout"] == "default" and "Результаты" in s["name"]:
                    result[i] = {"name": s["name"], "layout": "stats"}
                    break

    return result[:n_slides]


def _generate_with_claude(order, skeleton: list, tier_config: dict):
    client = _get_anthropic_client()
    model = tier_config.get("model", "claude-sonnet-4-6")
    system_prompt, user_prompt = _build_slides_prompts(order, skeleton)

    response = client.messages.create(**_messages_kwargs(
        model=model,
        max_tokens=16000,
        temperature=0.6,
        system=system_prompt,
        messages=[{"role": "user", "content": user_prompt}],
    ))

    stop_reason = getattr(response, "stop_reason", None)
    raw = response.content[0].text.strip() if response.content else ""
    if raw.startswith("```"):
        parts = raw.split("```")
        if len(parts) >= 3:
            inner = parts[1]
            if "\n" in inner:
                inner = inner.split("\n", 1)[1]
            raw = inner.strip()

    def _fallback(reason: str):
        logger.warning(
            f"Slides fallback for order {order.id}: {reason} "
            f"(stop_reason={stop_reason}, raw_len={len(raw)}, raw_head={raw[:200]!r})"
        )
        contents, _ = _generate_placeholder(order, skeleton)
        return contents, {
            "system": system_prompt,
            "user": user_prompt,
            "model": model,
            "temperature": 0.6,
            "max_tokens": 16000,
            "raw_response": raw,
            "stop_reason": stop_reason,
            "fallback_reason": reason,
            "placeholder_used": True,
        }

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as e:
        return _fallback(f"invalid JSON: {e}")

    if not isinstance(parsed, list):
        return _fallback(f"expected list, got {type(parsed).__name__}")

    contents = []
    for i, item in enumerate(parsed):
        try:
            slide = SlideContent.model_validate(item if isinstance(item, dict) else {})
            contents.append(slide.model_dump(exclude_none=True))
        except ValidationError as e:
            logger.warning(f"Slide {i} validation failed: {e}")
            contents.append({"bullets": ["Контент временно недоступен"]})

    while len(contents) < len(skeleton):
        contents.append({"bullets": ["—"]})
    contents = contents[: len(skeleton)]

    return contents, {
        "system": system_prompt,
        "user": user_prompt,
        "model": model,
        "temperature": 0.6,
        "max_tokens": 16000,
        "stop_reason": stop_reason,
        "pseudocode": (
            f"import anthropic\n"
            f"client = anthropic.Anthropic()\n"
            f"resp = client.messages.create(\n"
            f"    model=\"{model}\",\n"
            f"    max_tokens=16000,\n"
            f"    temperature=0.6,\n"
            f"    system=<system>,\n"
            f"    messages=[{{\"role\": \"user\", \"content\": <user>}}],\n"
            f")\n"
            f"slides = json.loads(resp.content[0].text)\n"
            f"# Для каждого slide с image_prompt — вызов DALL-E / Stability:\n"
            f"# img = openai.images.generate(prompt=slide['image_prompt'], size='1024x1024')"
        ),
        "raw_response": raw,
    }


def _build_slides_prompts(order, skeleton: list):
    """Собирает system+user промты для слайдов. Выделено, чтобы техническая
    панель возвращала ровно то, что ушло в Claude — для локальной проверки."""
    sections_list = "\n".join(
        f"{i+1}. [{s['layout']}] {s['name']}" for i, s in enumerate(skeleton)
    )

    # Утверждённый текст выступления — фундамент слайдов.
    speech_context = ""
    if order.include_speech and order.speech_approved and order.speech_text:
        # Даём Claude почти весь текст речи (до 40k символов — ~20k токенов русского).
        # Длинные работы влезают целиком, очень длинные — усекаются в хвосте.
        speech_context = (
            "\n\nУтверждённый пользователем ТЕКСТ ВЫСТУПЛЕНИЯ (далее — «РЕЧЬ»):\n"
            "```markdown\n"
            f"{order.speech_text[:40000]}\n"
            "```\n\n"
            "ЖЁСТКИЕ ПРАВИЛА СВЯЗИ слайдов с РЕЧЬЮ:\n"
            "1. Каждый bullet слайда должен быть краткой переформулировкой конкретной "
            "фразы/абзаца РЕЧИ. Никаких новых фактов, цифр, имён, дат — только то, "
            "что ДОКЛАДЧИК ПРОИЗНЕСЁТ.\n"
            "2. Если в РЕЧИ есть markdown-таблица (строки с `|` и разделителем `|---|`) — "
            "ОБЯЗАТЕЛЬНО воспроизведи её как отдельный слайд с `layout: \"table\"` "
            "(поля headers и rows строго по данным из РЕЧИ). Не превращай таблицу в bullets.\n"
            "3. Если в РЕЧИ есть числовой ряд с годами/категориями и значениями "
            "(ASCII-график, явный список типа «2020: 7,0 %, 2021: 5,4 %…», "
            "или таблица с временным столбцом) — воспроизведи в `layout: \"chart\"` "
            "(chart_type: line для времени, bar для категорий, pie для долей).\n"
            "4. Порядок слайдов должен следовать логике РЕЧИ: что идёт раньше в речи — "
            "раньше на слайдах.\n"
            "5. Цитаты в кавычках из РЕЧИ — идеальные кандидаты на `layout: \"quote\"`.\n"
            "6. Если в секции скелета нет материала в РЕЧИ — используй ближайшую "
            "по смыслу часть, но НЕ придумывай содержимое с нуля."
        )

    # Пожелания пользователя к этой пересборке.
    revision_hint = ""
    if order.slides_revision_note:
        revision_hint = (
            f"\n\nПожелания пользователя к этой версии слайдов:\n«{order.slides_revision_note}»\n"
            "Обязательно учти их (не нарушая ограничение: ничего нового, чего нет в тексте)."
        )
    elif order.slides_revisions > 0:
        revision_hint = (
            f"\n\nЭто пересборка #{order.slides_revisions}. Поменяй формулировки относительно предыдущей версии."
        )

    custom_part = ""
    if order.custom_elements:
        custom_part = (
            f"\n\nПользователь просит обязательно отразить в слайдах:\n«{order.custom_elements}»"
        )

    # Визуальная палитра (pptxgen.js красит её цветами; Claude адаптирует тон слов).
    palette_id = order.palette or "midnight_executive"
    palette_mood = PALETTE_MOODS.get(palette_id, "нейтральный академический")

    # Плотность текста — напрямую из detail_level.
    detail_directive = DETAIL_DIRECTIVES.get(order.detail_level or "standard", DETAIL_DIRECTIVES["standard"])

    # Тональность — от типа работы.
    work_tone = WORK_TYPE_TONE.get(order.work_type or "", "нейтральный академический")

    # Декоративные SVG-иллюстрации разрешены всем, кроме ВКР/защиты диплома.
    allow_images = (order.work_type or "").strip() not in ("ВКР",)
    if allow_images:
        images_rule = (
            "Декоративные SVG-акценты (image_prompt):\n"
            "  • Это НЕ основная картинка слайда — это маленький декоративный значок "
            "(~5% площади слайда, в углу), оживляющий вёрстку.\n"
            "  • Стиль: абстрактная геометрия — круги, линии, сетки, дуги, силуэт "
            "символа тематики. Тонкие линии, никакого реализма.\n"
            "  • На английском. Одно короткое предложение (до 15 слов).\n"
            "  • СТРОГО БЕЗ ТЕКСТА: no text, no words, no letters, no numbers, "
            "no captions, no labels, no writing of any kind.\n"
            "  • Ставь image_prompt на 40–60% содержательных слайдов (default/two_col/callout), "
            "на ВСЕХ сразу не надо — приедается.\n"
            "  • НЕ ставь image_prompt на layout=section/quote/stats/table/chart "
            "(там уже своя визуальная логика).\n"
            "  • Пример: "
            "\"abstract geometric mark of concentric arcs and a single dot, minimal line art\".\n"
            "  • Смысл: намёк на тему слайда, не буквальная иллюстрация. "
            "Одну и ту же метафору не повторяй на разных слайдах."
        )
    else:
        images_rule = (
            "НЕ добавляй поле image_prompt ни на одном слайде — "
            "для ВКР/дипломной защиты иллюстрации не используем."
        )

    # Режим (source_grounded/no_template) → ссылки на страницы.
    mode = order.mode or "source_grounded"
    mode_rule = (
        "Режим source_grounded: source_ref ОБЯЗАТЕЛЕН на каждом content-слайде (см. раздел 3)."
        if mode == "source_grounded"
        else "Режим no_template: source_ref не требуется. Полная свобода формулировок."
    )

    # Enhance-режим: юзер разрешил Claude дополнять фактами из общих знаний.
    # USP сохраняется через маркировку source_ref = «общее знание» на enhance-слайдах.
    allow_enhance = bool(getattr(order, "allow_enhance", False))
    if allow_enhance:
        enhance_rule = (
            "Разрешено дополнять контент фактами из общих знаний (статистика, исторический контекст, "
            "общеизвестные факты). НО каждый такой слайд ДОЛЖЕН иметь source_ref = «общее знание», "
            "чтобы читатель понимал, какие тезисы основаны на работе, а какие — нет. "
            "Слайды на основе РЕЧИ/источника по-прежнему должны иметь source_ref формата «с. N» "
            "или «<источник>, с. N»."
        )
        fact_integrity_mode = (
            "Fact integrity (enhance-режим): цифры/имена/даты из РЕЧИ — воспроизводи точно. "
            "На enhance-слайдах (source_ref = «общее знание») можешь добавлять общеизвестные "
            "факты с консервативной точностью: диапазоны предпочтительнее точных цифр, без "
            "выдуманных ФИО и специфических процентов без опоры. Смешивание «с. N» и «общее знание» "
            "в одном буллете ЗАПРЕЩЕНО — всегда один source_ref на весь слайд."
        )
    else:
        enhance_rule = (
            "СТРОГО из РЕЧИ: никаких фактов, цифр, имён, дат — не встречающихся в РЕЧИ."
        )
        fact_integrity_mode = (
            "Fact integrity (строгий режим): ни одного числа/имени/даты вне РЕЧИ. "
            "Каждая named entity ДОЛЖНА встречаться в РЕЧИ буквально или как морфологическая форма."
        )

    tech_gate = ""
    if order.skip_tech_details:
        tech_gate = (
            "\n- На слайдах НЕ раскрывай технические детали реализации "
            "(стек, архитектура, БД, конкретные библиотеки, код). "
            "Говори о продукте, решениях и пользовательских сценариях."
        )

    system_prompt = f"""Ты — редактор академических презентаций уровня качественной деловой прессы. Задача: превратить текст выступления (РЕЧЬ) и параметры заказа в плотный, фактический JSON-массив слайдов.

## Общие правила
- Язык: русский. Никаких «Слайд N», «Презентация», вводных формул вроде «Добро пожаловать».
- Тон: {work_tone}
- Палитра: {palette_id} — {palette_mood}. Подбирай слова под настроение.
- Плотность: {detail_directive}
- {mode_rule}
- {images_rule}{tech_gate}
- Ответ — ТОЛЬКО валидный JSON-массив, без ```markdown```.

## 1. КРИТЕРИИ КАЧЕСТВА СЛАЙДА (самое важное)

### Named entities pass
Перед тем как писать контент — просканируй РЕЧЬ на: города/регионы, компании/ведомства, ФИО/должности, профессии, конкретные числа-годы-проценты, названия программ/законов/проектов. Используй их дословно в релевантных слайдах. Не заменяй «Прокопьевск −4,2%» на «депрессивные моногорода», «СУЭК» на «ключевые игроки отрасли», «водитель БелАЗа» на «рабочие специальности».

### Density floor
Каждый content-слайд обязан содержать минимум одно из:
(а) число с единицей/процентом («42,3 %», «1,3 млн чел.»),
(б) имя собственное (город/компания/ФИО/профессия/название программы),
(в) прямая цитата из РЕЧИ.
Слайд без (а)/(б)/(в) — вода. Перепиши или замени на layout=section.

### Fact integrity
{fact_integrity_mode}
- Если в РЕЧИ есть диапазон («40–50 %») — передавай диапазон, не усредняй.
- Единицы измерения — только те, что в РЕЧИ. Не подставляй «руб.», «%», «тыс.», если их там нет.
- Сомневаешься в факте — не вставляй вообще. Лучше буллет меньше, чем выдуманный.
- Если источник беден на сущности (теоретическая работа) — обобщение уместно, не натягивай конкретику насильно.

### Режим наполнения
{enhance_rule}

### Anti-patterns (НЕ пиши на слайдах)
- Присказки докладчика: «Как мы видим», «Давайте рассмотрим», «В заключение», «Перейдём к…», «Спасибо за внимание».
- Канцелярит: «данный вопрос актуален», «играет важную роль», «в современных реалиях», «имеет место быть».
- Мета-фразы: «на этом слайде», «следующий раздел посвящён».
- Пустые одно-словные буллеты («Анализ», «Проблема», «Решение»).

## 2. ВЫБОР LAYOUT (decision tree — сверху вниз, бери ПЕРВОЕ сработавшее)

1. **≥3 числа с единицами/процентами на общую тему** → `stats` (3–4 плитки).
2. **Временной ряд ≥3 точек** («2020: X; 2021: Y; 2022: Z») → `chart`, chart_type: line.
3. **Сравнение ≥3 категорий по одному показателю** → `chart` (bar) или `table`.
4. **Доли одного целого (100 %)** → `chart`, chart_type: pie (до 6 сегментов).
5. **Матрица ≥3 строк × ≥2 колонок** → `table` (до 10 строк, 5 колонок).
6. **Цитата в кавычках / афоризм ≤160 симв** → `quote`.
7. **Переход между блоками / название главы** → `section`.
8. **Противопоставление двух сущностей** (до/после, теория/практика) → `two_col`.
9. **Один сильный тезис + 2–3 пояснения** → `callout`.
10. **Иначе** → `default` с bullets (≤4 буллетов, минимум 1 содержит число/имя/термин).

**ПРИОРИТЕТ:** если данные подходят под stats/chart/table — НИКОГДА не сворачивай их в bullets. Плоский список цифр запрещён.

**Запрет на дублирование:** title и callout не парафразируют друг друга; bullets не пересказывают callout; intro у stats/chart/table даёт контекст и единицу измерения, но не повторяет те же числа, что в плитках/графике/таблице.

## 3. ССЫЛКИ НА ИСТОЧНИК — core USP продукта

На каждом content-слайде (layouts: default, callout, two_col, stats, table, chart, image_side) поле **`source_ref` ОБЯЗАТЕЛЬНО**.

Формат строго один из:
- `«с. N»` или `«с. N–M»` — страница или диапазон из работы студента
- `«Росстат, 2023, с. 12»` — цитируется внешний источник из РЕЧИ (c годом публикации)
- `«Раздел "<название>"»` — раздел известен, страница нет
- `«источник: загруженная работа»` — fallback, только если страница реально не установлена
- `«общее знание»` — ТОЛЬКО в enhance-режиме (см. «Режим наполнения» выше), для слайдов на основе общих знаний

Запрещено: «≈ с. 10», «примерно с. 40», «см. материалы», «источники см. в приложении».
Длина source_ref ≤80 симв, без точки в конце.
Для `quote` source_ref не нужен — страница идёт в поле `attribution`: «Иванов И.И., 2020, с. 47».
Для `section` — source_ref не нужен (это разделитель, не контент).

## 4. СХЕМА JSON

```
default:    {{"bullets": ["…"], "source_ref": "с. 12", "image_prompt?": "…"}}
callout:    {{"callout": "≤120 симв", "bullets": ["…"], "source_ref": "с. 12", "image_prompt?": "…"}}
two_col:    {{"columns": [{{"heading": "…", "bullets": ["…"]}}, …], "source_ref": "с. 12"}}
section:    {{"subtitle": "≤60 симв"}}
quote:      {{"quote": "≤160 симв", "attribution": "Автор, с. 47"}}
stats:      {{"intro?": "контекст и единица", "stats": [{{"value": "42,3 %", "label": "≤6 слов"}}, …], "source_ref": "с. 12"}}
table:      {{"layout": "table", "intro?": "…", "headers": [...], "rows": [[...]], "source_ref": "Росстат, с. 12"}}
chart:      {{"layout": "chart", "chart_type": "bar"|"line"|"pie", "intro?": "…", "labels": [...], "series": [{{"name": "Показатель, %", "data": [1,2,3]}}], "source_ref": "с. 12"}}
```

Замечания:
- table: числа с единицами в ячейках («12,4 %», «1 287 тыс.»), имена колонок короткие.
- chart: значения в `data` — числа БЕЗ единиц (единица уходит в `series[].name`: «Безработица, %»). Имена серий ≤20 симв. Bar/line ≤8 точек на серию. Pie ≤6 сегментов.
- layout: table/chart разрешено выставлять самому на слотах default/two_col, если данные того требуют.

## 5. ЭТАЛОННАЯ ПЛОТНОСТЬ (few-shot)

Три примера слайдов уровня, к которому стремимся. Обрати внимание: 4+ конкретных числа, названные сущности, intro не повторяет title, source_ref проставлен.

**A. stats — открытие раздела цифрами**
```json
{{"layout": "stats",
  "intro": "Россия 1990–2023: ключевые демографические индикаторы.",
  "stats": [
    {{"value": "147,4 млн", "label": "Население в 1990, РСФСР"}},
    {{"value": "146,2 млн", "label": "Население в 2023"}},
    {{"value": "−5,1 млн", "label": "Убыль 1992–2012 без миграции"}},
    {{"value": "1,41", "label": "СКР в 2023 (1,89 в 1990)"}}
  ],
  "source_ref": "Росстат, Демежегодник 2023, с. 34"}}
```

**B. chart — временной ряд с контекстом**
```json
{{"layout": "chart", "chart_type": "line",
  "intro": "Естественный прирост населения РФ, тыс. чел. Пик убыли — 2000 (−958,5), возврат в плюс — 2013 (+24).",
  "labels": ["1990", "2000", "2005", "2013", "2020", "2023"],
  "series": [{{"name": "Прирост, тыс. чел.", "data": [333.6, -958.5, -846.5, 24.0, -702.1, -495.3]}}],
  "source_ref": "ЕМИСС, показатель 31293, с. 12"}}
```

**C. table — сравнение регионов**
```json
{{"layout": "table",
  "intro": "Пять регионов с максимальной убылью населения 2010–2023.",
  "headers": ["Регион", "2010, тыс.", "2023, тыс.", "Δ, %", "Миграц. отток"],
  "rows": [
    ["Тамбовская обл.", "1 091", "974", "−10,7", "38 %"],
    ["Кировская обл.", "1 341", "1 153", "−14,0", "52 %"],
    ["Курганская обл.", "910", "799", "−12,2", "61 %"],
    ["Магаданская обл.", "157", "136", "−13,4", "84 %"],
    ["Республика Коми", "902", "726", "−19,5", "71 %"]
  ],
  "source_ref": "Росстат, Регионы России 2024, с. 87"}}
```
"""

    presenter_line = ""
    if order.presenter_name or order.presenter_role:
        presenter_line = (
            f"- Докладчик: {order.presenter_name or '—'}"
            f"{', ' + order.presenter_role if order.presenter_role else ''}\n"
        )

    user_prompt = f"""Параметры работы:
- Тема: {order.topic}
{presenter_line}- Тип работы: {order.work_type or 'не указан'}
- Направление: {order.direction or 'не указано'}
- Учебное заведение: {order.university or 'не указано'}
- Тезис/гипотеза: {order.thesis or 'не указан'}
- Детальность: {order.detail_level or 'standard'}
- Режим: {mode}
- Палитра: {palette_id}
- Длительность выступления: {order.duration_minutes or '—'} мин
- Количество слайдов: {len(skeleton)}{custom_part}{speech_context}{revision_hint}

Структура слайдов (layout определяет формат):
{sections_list}

Сгенерируй JSON-массив ровно из {len(skeleton)} объектов в указанном порядке.
Верни только JSON-массив, без пояснений."""

    return system_prompt, user_prompt


# ── Speech text ──────────────────────────────────────────────────────────────

# Тип работы → тональность и формула открытия.
# ВКР (защита диплома) — строгий формат «Добрый день, уважаемая комиссия…».
# Курсовая/реферат/семинар — нейтральный разговорный тон без комиссии.
def _speech_style(order) -> dict:
    """Тональность и формула открытия выступления в зависимости от типа работы
    и известных данных о докладчике. Принимает сам order, чтобы использовать
    presenter_name / presenter_role, если они указаны."""
    wt = (order.work_type or "").lower()
    name = (order.presenter_name or "").strip() or "[Имя]"
    role = (order.presenter_role or "").strip()
    role_suffix = f", {role}" if role else ""

    if "вкр" in wt or "диплом" in wt or "магистер" in wt:
        return {
            "formality": "строго формальный, академический",
            "opener": f"Добрый день, уважаемая комиссия. Меня зовут {name}{role_suffix}, "
                      "представляю работу на тему «{topic}».",
            "closer": "Благодарю за внимание. Готов(а) ответить на ваши вопросы.",
            "audience": "государственная аттестационная комиссия",
        }
    if "курсов" in wt:
        return {
            "formality": "уверенный академический, но без обращения к комиссии",
            "opener": f"Здравствуйте. Меня зовут {name}{role_suffix}. Моя работа посвящена теме «{{topic}}».",
            "closer": "Спасибо за внимание.",
            "audience": "преподаватель и одногруппники",
        }
    if "реферат" in wt or "школь" in wt:
        return {
            "formality": "простой и ясный, разговорный",
            "opener": f"Здравствуйте. Меня зовут {name}. Я расскажу про «{{topic}}».",
            "closer": "Спасибо, что выслушали.",
            "audience": "учитель и одноклассники",
        }
    if "семинар" in wt:
        return {
            "formality": "дискуссионный, обращающий аудиторию к обсуждению",
            "opener": f"Коллеги, меня зовут {name}{role_suffix}. Сегодня обсудим тему «{{topic}}».",
            "closer": "Предлагаю перейти к обсуждению.",
            "audience": "коллеги/участники семинара",
        }
    if "личн" in wt or "продуктов" in wt or "проект" in wt:
        return {
            "formality": "уверенная продуктовая, product-demo, от первого лица, без академизма",
            "opener": f"Здравствуйте. Меня зовут {name}{role_suffix}. Расскажу про мой личный проект — «{{topic}}».",
            "closer": "На этом у меня всё. Готов ответить на вопросы.",
            "audience": "сокурсники и преподаватели",
        }
    if "доклад" in wt:
        return {
            "formality": "нейтрально-деловой, информативный, без академической чопорности",
            "opener": f"Здравствуйте. Меня зовут {name}{role_suffix}. Тема доклада — «{{topic}}».",
            "closer": "Спасибо за внимание.",
            "audience": "слушатели доклада",
        }
    return {
        "formality": "нейтрально-академический",
        "opener": f"Здравствуйте. Меня зовут {name}{role_suffix}. Работа посвящена теме «{{topic}}».",
        "closer": "Спасибо за внимание.",
        "audience": "слушатели",
    }


def _generate_speech(order, tier_config):
    """Возвращает (markdown_text, prompt_record_dict)."""
    duration = order.duration_minutes or 10
    # Всегда собираем prompt_record — даже без API-ключа. Это нужно, чтобы
    # пользователь мог скопировать его и прогнать в Claude локально.
    system_prompt, user_prompt = _build_speech_prompts(order, duration)
    model = tier_config.get("model", "claude-sonnet-4-6")

    record = {
        "system": system_prompt,
        "user": user_prompt,
        "model": model,
        "max_tokens": 16000,
        "temperature": 0.7,
        "pseudocode": (
            f"import anthropic\n"
            f"client = anthropic.Anthropic()\n"
            f"resp = client.messages.create(\n"
            f"    model=\"{model}\",\n"
            f"    max_tokens=16000,\n"
            f"    temperature=0.7,\n"
            f"    system=<system>,\n"
            f"    messages=[{{\"role\": \"user\", \"content\": <user>}}],\n"
            f")\n"
            f"text = resp.content[0].text.strip()"
        ),
        "raw_response": None,
    }

    if settings.ANTHROPIC_API_KEY:
        try:
            text, raw = _speech_with_claude(order, tier_config, duration, system_prompt, user_prompt)
            record["raw_response"] = raw
            return text, record
        except Exception as e:
            logger.warning(f"Claude speech failed ({e}), falling back to placeholder")
    text = _speech_placeholder(order, duration)
    record["placeholder_used"] = True
    return text, record


def _build_speech_prompts(order, duration: int):
    """Собирает system+user промты для текста выступления — единая точка для
    реального запроса и технической панели («скопировал, запустил локально»)."""
    style = _speech_style(order)

    system_prompt = (
        f"Ты помогаешь представить работу. Пишешь текст выступления на русском, "
        f"тональность: {style['formality']}. Аудитория: {style['audience']}. "
        f"Открытие: «{style['opener']}». Закрытие: «{style['closer']}». "
        "Формат — Markdown с разделами '# Вступление', '# Основная часть', '# Заключение'. "
        "Длительность указана пользователем — рассчитывай ~120 слов в минуту. "
        "Не используй «уважаемая комиссия», если тип работы не ВКР/диплом."
    )

    if order.skip_tech_details:
        system_prompt += (
            " В выступлении НЕ раскрывай технические детали реализации (стек, архитектура, БД, инструменты). "
            "Если без них ответить нельзя — одна-две общие фразы «реализацию вела команда разработки». "
            "На возможные технические вопросы от комиссии/аудитории предусмотри формулировку "
            "«за техническую часть отвечают ребята из команды разработки»."
        )

    revision_hint = ""
    if order.speech_revisions > 0:
        revision_hint += (
            f"\n\nЭто пересборка #{order.speech_revisions}. Сделай её заметно отличающейся "
            "от предыдущей версии по формулировкам и структуре."
        )
    if order.speech_revision_note:
        revision_hint += (
            f"\n\nПожелания пользователя к этой версии:\n«{order.speech_revision_note}»\n"
            "Обязательно учти их."
        )

    custom_part = ""
    if order.custom_elements:
        custom_part = (
            f"\n\nДополнительно пользователь просит обязательно включить в выступление:\n"
            f"«{order.custom_elements}»"
        )

    presenter_line = ""
    if order.presenter_name or order.presenter_role:
        presenter_line = (
            f"Докладчик: {order.presenter_name or '—'}"
            f"{', ' + order.presenter_role if order.presenter_role else ''}\n"
        )

    user_prompt = (
        f"Тема: {order.topic}\n"
        f"{presenter_line}"
        f"Тип работы: {order.work_type or '—'}\n"
        f"Учебное заведение: {order.university or '—'}\n"
        f"Тезис/гипотеза: {order.thesis or '—'}\n"
        f"Длительность: {duration} минут\n"
        f"Детальность: {order.detail_level or 'standard'}"
        f"{custom_part}"
        f"{revision_hint}\n\n"
        "Напиши полный текст выступления в Markdown. Без вводных фраз — сразу текст."
    )
    return system_prompt, user_prompt


def _speech_with_claude(order, tier_config, duration: int, system_prompt: str, user_prompt: str):
    client = _get_anthropic_client()
    _model = tier_config.get("model", "claude-sonnet-4-6")
    response = client.messages.create(**_messages_kwargs(
        model=_model,
        max_tokens=16000,
        temperature=0.7,
        system=system_prompt,
        messages=[{"role": "user", "content": user_prompt}],
    ))
    if response.stop_reason == "max_tokens":
        logger.warning(
            f"Speech for order {order.id} hit max_tokens cap (duration={duration}m) — output truncated"
        )
    raw = response.content[0].text.strip()
    return raw, raw


def _speech_placeholder(order, duration: int) -> str:
    topic = order.topic or "—"
    thesis = order.thesis or "—"
    style = _speech_style(order)
    opener = style["opener"].replace("{topic}", topic)
    closer = style["closer"]

    rev_note = ""
    if order.speech_revisions:
        rev_note = f"\n\n> Версия #{order.speech_revisions + 1} — переформулировка по запросу пользователя."
    if order.speech_revision_note:
        rev_note += f"\n> Пожелания: «{order.speech_revision_note}»"

    custom_block = ""
    if order.custom_elements:
        custom_block = f"\n\n> Пользователь просит включить: «{order.custom_elements}»\n"

    return f"""# Текст выступления{rev_note}{custom_block}

> Плейсхолдер. Чтобы получить полноценный текст, подключите ANTHROPIC_API_KEY на сервере.

## Вступление (≈1 мин)

{opener}

Актуальность темы обусловлена необходимостью системного анализа и практического применения
представленного материала в современных условиях.

## Основная часть (≈{max(duration - 2, 3)} мин)

### Цели и задачи

Цель работы — исследовать ключевые аспекты темы и предложить обоснованные выводы.
Для достижения цели поставлены задачи: провести обзор литературы, собрать и проанализировать
данные, сформулировать практические рекомендации.

### Методология

Исследование построено на сочетании теоретического анализа и эмпирических данных.
Использованы методы сравнительного, количественного и качественного анализа.

### Ключевые результаты

Основной тезис работы: **{thesis}**

Получены следующие результаты:
1. Подтверждена выдвинутая гипотеза на основании собранных данных.
2. Выявлены закономерности, характерные для предметной области.
3. Сформулированы практические рекомендации, имеющие прикладное значение.

### Обсуждение

Полученные результаты согласуются с существующими работами в этой области и вносят
дополнение к пониманию темы. Особо важно отметить практическую применимость выводов.

## Заключение (≈1 мин)

Таким образом, в ходе работы были достигнуты поставленные цели и решены задачи.
Результаты исследования имеют как теоретическое, так и практическое значение.

{closer}
"""


# ── Placeholder: контент без Claude ──────────────────────────────────────────


def _generate_placeholder(order, skeleton: list):
    """Placeholder-контент для всех layout'ов (включая новые: quote/stats/image_*).
    При живом ключе Claude сам заполняет поля — placeholder нужен только для прогонов без API.
    """
    topic = order.topic or "Без темы"
    allow_images = (order.work_type or "").strip() not in ("ВКР",)
    contents = []
    for s in skeleton:
        layout = s["layout"]
        name = s["name"]
        if layout == "section":
            slide = {"subtitle": f"Раздел: {name}"}
        elif layout == "callout":
            slide = {
                "callout": f"«{topic[:70]}» — ключевая тема исследования",
                "bullets": [
                    f"Актуальность раздела «{name}» в контексте работы",
                    "Теоретическое и практическое значение",
                ],
            }
        elif layout == "two_col":
            slide = {
                "columns": [
                    {"heading": f"{name} (часть 1)", "bullets": ["Аспект 1", "Аспект 2", "Аспект 3"]},
                    {"heading": f"{name} (часть 2)", "bullets": ["Аспект A", "Аспект B", "Аспект C"]},
                ]
            }
        elif layout == "quote":
            slide = {
                "quote": f"Исследование «{topic[:80]}» открывает новые грани понимания.",
                "attribution": (order.thesis[:60] if order.thesis else "тезис работы"),
            }
        elif layout == "stats":
            slide = {
                "intro": f"Ключевые показатели по теме «{topic[:60]}»",
                "stats": [
                    {"value": "100%", "label": "покрытие материала"},
                    {"value": "3", "label": "ключевых вывода"},
                    {"value": "5", "label": "источников"},
                    {"value": "2025", "label": "год исследования"},
                ],
            }
        elif layout == "image_full":
            slide = {}
            if allow_images:
                slide["image_prompt"] = (
                    f"minimalist conceptual illustration representing {name.lower()}, "
                    "soft gradient tones, no text"
                )
        elif layout == "image_side":
            slide = {
                "side": "right" if (len(contents) % 2 == 0) else "left",
                "bullets": [
                    f"Ключевой аспект «{name}»",
                    "Теоретическое обоснование",
                    "Практический пример",
                ],
            }
            if allow_images:
                slide["image_prompt"] = (
                    f"minimalist conceptual illustration about {name.lower()}, "
                    "soft tones, no text, no words"
                )
        else:
            slide = {
                "bullets": [
                    f"Ключевой аспект раздела «{name}»",
                    "Теоретическое обоснование",
                    "Практические примеры",
                    f"Связь с темой «{topic[:40]}»",
                ]
            }
        contents.append(slide)
    note = {"note": "Placeholder", "topic": topic}
    return contents, note


def _assemble_plan(order, tier_config, skeleton, contents, output_path) -> dict:
    slides = []
    for sec, content in zip(skeleton, contents):
        slide = {"title": sec["name"], "layout": sec["layout"]}
        slide.update(content)
        # Override layout только если Claude предложил table/chart И данные валидны.
        # Иначе откатываемся на skeleton-layout (во избежание пустых слайдов).
        override = content.get("layout")
        if override in OVERRIDABLE_LAYOUTS and sec["layout"] in ("default", "two_col"):
            if override == "table" and content.get("rows") and content.get("headers"):
                slide["layout"] = "table"
            elif override == "chart" and content.get("series") and content.get("labels"):
                slide["layout"] = "chart"
            else:
                slide["layout"] = sec["layout"]  # rollback
        else:
            slide["layout"] = sec["layout"]
        # source_ref должен быть на ВСЕХ content-слайдах — это core USP продукта.
        # Если Claude не проставил — ставим fallback, чтобы слайд не остался без атрибуции.
        CONTENT_LAYOUTS = {"default", "callout", "two_col", "stats", "table", "chart", "image_side"}
        if slide["layout"] in CONTENT_LAYOUTS and order.mode == "source_grounded":
            slide.setdefault("source_ref", "источник: загруженная работа")
        slides.append(slide)

    return {
        "topic": order.topic or "Без темы",
        "work_type": order.work_type or "",
        "university": order.university or "",
        "thesis": order.thesis or "",
        "direction": order.direction or "",
        "duration_minutes": order.duration_minutes or 15,
        "detail_level": order.detail_level or "standard",
        "mode": order.mode or "source_grounded",
        "palette": order.palette or "midnight_executive",
        "tier": order.tier,
        "tier_label": tier_config.get("label", order.tier),
        "total_slides": len(slides) + 2,
        "model": tier_config.get("model", "claude-sonnet-4-6"),
        "has_uploaded_file": False,
        "output_path": output_path,
        "slides": slides,
    }
