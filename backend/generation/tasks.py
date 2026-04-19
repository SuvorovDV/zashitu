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


# Хекс-пары (primary, accent) по палитре — для SVG-промптов.
# Должны совпадать с PALETTES в pptxgen.js — меняй синхронно.
# (PALETTE_MOODS / DETAIL_DIRECTIVES / WORK_TYPE_TONE — переехали в prompts/_shared.py.)
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

        # Источником фактов для речи может быть либо PDF/DOCX студента, либо web search.
        # Если работа загружена — речь пишется «из весов» (PDF читается только на этапе слайдов,
        # это отдельная история). Если работы НЕТ — включаем web_search, чтобы речь
        # опиралась на свежие авторитетные источники, а не на эрудицию модели.
        from models import UploadedFile
        has_source = (
            db.query(UploadedFile).filter(UploadedFile.order_id == order_id).first() is not None
        )

        text, prompt_record = _generate_speech(order, tier_config, has_source=has_source)

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

        # Scaffold-speech: если юзер НЕ заказывал отдельный текст выступления и
        # речи у нас ещё нет — генерируем её внутри pipeline как фактическую базу
        # для skeleton + слайдов. Без неё слайды собирались бы только из
        # topic+thesis (тонко). Юзер scaffold-речь НЕ получает: download-speech
        # endpoint гейтит по include_speech (см. files/router.py).
        if not order.speech_text:
            has_source = file_path is not None
            scaffold_text, scaffold_record = _generate_speech(
                order, tier_config, has_source=has_source,
            )
            order.speech_text = scaffold_text
            order.speech_approved = True  # юзер её не ревьюит — auto-approve
            order.speech_prompt = json.dumps(
                {"scaffold": True, **scaffold_record},
                ensure_ascii=False, indent=2,
            )
            db.commit()
            logger.info(
                f"Order {order_id} scaffold speech generated ({len(scaffold_text)} chars) "
                f"for slides-only flow (web_search={scaffold_record.get('web_search_enabled')})"
            )

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


def _pick_palette(order, tier_config) -> str:
    """Просит Claude выбрать одну из палитр под тему/тип презентации.

    Лёгкий one-shot вызов (sonnet, max_tokens 32). При любой ошибке/пустом
    ответе → fallback на midnight_executive (нейтральная корпоративная).
    """
    from generation.prompts._shared import PALETTE_MOODS

    palette_options = "\n".join(f"- {pid}: {mood}" for pid, mood in PALETTE_MOODS.items())
    system_prompt = (
        "Ты подбираешь цветовую палитру под тему презентации. "
        "Возвращай ТОЛЬКО id одной палитры из списка, без кавычек, без пояснений.\n\n"
        f"Доступные палитры:\n{palette_options}"
    )
    user_prompt = (
        f"Тема: {order.topic}\n"
        f"Тип презентации: {order.work_type or '—'}\n"
        f"Тезис: {order.thesis or '—'}\n\n"
        "Какая палитра подходит лучше всего? Верни только id."
    )

    if not settings.ANTHROPIC_API_KEY:
        return "midnight_executive"

    try:
        client = _get_anthropic_client()
        # Всегда sonnet для палитры — дёшево и быстро, opus тут оверкилл.
        resp = client.messages.create(**_messages_kwargs(
            model="claude-sonnet-4-6",
            max_tokens=32,
            temperature=0.3,
            system=system_prompt,
            messages=[{"role": "user", "content": user_prompt}],
        ))
        raw = (resp.content[0].text if resp.content else "").strip().lower()
        # Чистим возможные ` или кавычки.
        raw = raw.strip("`'\" \n").split()[0] if raw else ""
        if raw in PALETTE_MOODS:
            return raw
        logger.warning(f"Palette picker returned unknown id '{raw}', falling back")
    except Exception as e:
        logger.warning(f"Palette picker failed ({e}), falling back to default")
    return "midnight_executive"


def _pptxgenjs_generator(order, file_path, tier_config):
    Path(settings.OUTPUT_DIR).mkdir(parents=True, exist_ok=True)
    output_filename = f"{uuid.uuid4()}.pptx"
    output_path = (Path(settings.OUTPUT_DIR) / output_filename).resolve()

    # Auto-pick палитру под тему, если юзер выбрал «Авто» в Step10.
    # Резолвится один раз и подставляется в order для всех downstream-вызовов.
    if (order.palette or "").strip().lower() == "auto":
        picked = _pick_palette(order, tier_config)
        order.palette = picked
        logger.info(f"Order {order.id} palette auto-picked: {picked}")

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

    from generation.prompts import get_prompt_module
    pm = get_prompt_module(order.work_type)
    allow_images = (order.work_type or "").strip() not in ("ВКР",)

    # Type-aware skeleton: каждый промт-модуль (school_essay/presentation/academic)
    # подставляет свой структурный канон. Школьник не получит «Литературу/Цели»,
    # доклад не получит «Что такое X».
    system_prompt = pm.build_skeleton_system_prompt(order, n_slides, allow_images)

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

    # Юзер видит «N слайдов» в wizard и ожидает их в .pptx. pptxgen.js всегда
    # добавляет titleSlide + finalSlide → 2 авто-слайда. Поэтому контентных = N - 2,
    # чтобы общее в файле совпадало с тем, что юзер выбрал.
    AUTO_SLIDES = 2  # title + final

    if user_count and isinstance(user_count, int) and user_count > 0:
        n_slides = max(6, min(40, user_count) - AUTO_SLIDES)
    elif duration and isinstance(duration, int) and duration > 0:
        # 1.1 sl/min: 10 мин → 11 → 9 контентных + title + final = 11 в .pptx.
        n_slides = max(6, min(tier_max, round(duration * 1.1)) - AUTO_SLIDES)
    else:
        n_slides = max(6, tier_config.get("slides", 12) - AUTO_SLIDES)

    # Если есть утверждённый текст речи (юзера или scaffold внутри slides_task) —
    # скелет выводим ИЗ РЕЧИ, а не из дефолтного академического пула. Это даёт:
    # (1) Titles слайдов, которые реально соответствуют содержимому спича
    #     → контент-проход не «натягивает» абстракции на «Цели и задачи»;
    # (2) Маркировка речи при скачивании становится точной (каждый абзац
    #     находит свой заголовок слайда).
    # include_speech намеренно НЕ проверяем — scaffold-речь генерится и при False.
    if (
        getattr(order, "speech_approved", False)
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

    # NER-валидатор — объективный бэкстоп: ловит сущности (города/компании/числа/годы),
    # которые появились на слайдах, но отсутствуют в исходнике. Для фраз-уровневых
    # галлюцинаций не работает (нужна семантика). Сейчас — только логирование, без retry;
    # будем копить сигнал, прежде чем принимать решения на его основе.
    hallucinated: list = []
    if getattr(settings, "NER_VALIDATE_ENABLED", True):
        try:
            from generation.ner_validator import validate_slides, summarize
            source_parts = []
            if getattr(order, "speech_text", None):
                source_parts.append(order.speech_text)
            if getattr(order, "thesis", None):
                source_parts.append(order.thesis)
            if getattr(order, "topic", None):
                source_parts.append(order.topic)
            source_text = "\n\n".join(p for p in source_parts if p)
            hallucinated = validate_slides(contents, source_text)
            if hallucinated:
                logger.warning(
                    f"NER validator for order {getattr(order, 'id', '?')}: "
                    f"{summarize(hallucinated)}"
                )
            else:
                logger.info(f"NER validator for order {getattr(order, 'id', '?')}: clean")
        except Exception as e:
            logger.warning(f"NER validator crashed (ignored): {e}")

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
        "hallucinated_entities": hallucinated,
    }


def _build_slides_prompts(order, skeleton: list):
    """Тонкий делегат: выбираем промт-модуль по типу презентации (school_essay,
    presentation, academic-fallback) и собираем system+user через него.

    Каждый тип имеет свой структурный канон, layout-приоритеты и few-shot,
    но JSON-схему / source-ref / anti-patterns шарит из prompts/_shared.py.
    См. backend/generation/prompts/__init__.py.
    """
    from generation.prompts import get_prompt_module
    from generation.prompts._shared import build_slides_user_prompt

    pm = get_prompt_module(order.work_type)
    palette_id = order.palette or "midnight_executive"
    # SVG-декор отключаем только на ВКР (legacy academic-канон).
    allow_images = (order.work_type or "").strip() not in ("ВКР",)

    system_prompt = pm.build_slides_system_prompt(
        order, allow_images=allow_images, palette_id=palette_id,
    )
    type_label = getattr(pm, "PRESENTATION_TYPE_LABEL", order.work_type or "—")
    user_prompt = build_slides_user_prompt(order, skeleton, type_label)
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


def _generate_speech(order, tier_config, has_source: bool = True):
    """Возвращает (markdown_text, prompt_record_dict).

    has_source=False → юзер не загрузил PDF/DOCX; включаем web_search (если разрешён
    в settings), чтобы Claude нашёл реальные источники по теме, а не сочинял из весов.
    """
    duration = order.duration_minutes or 10
    use_web_search = bool(settings.WEB_SEARCH_ENABLED) and not has_source
    # Всегда собираем prompt_record — даже без API-ключа. Это нужно, чтобы
    # пользователь мог скопировать его и прогнать в Claude локально.
    system_prompt, user_prompt = _build_speech_prompts(order, duration, use_web_search=use_web_search)
    model = tier_config.get("model", "claude-sonnet-4-6")

    record = {
        "system": system_prompt,
        "user": user_prompt,
        "model": model,
        "max_tokens": 16000,
        "temperature": 0.7,
        "has_source": has_source,
        "web_search_enabled": use_web_search,
        "pseudocode": (
            f"import anthropic\n"
            f"client = anthropic.Anthropic()\n"
            f"resp = client.messages.create(\n"
            f"    model=\"{model}\",\n"
            f"    max_tokens=16000,\n"
            f"    temperature=0.7,\n"
            f"    system=<system>,\n"
            f"    messages=[{{\"role\": \"user\", \"content\": <user>}}],\n"
            + (
                f"    tools=[{{\"type\": \"web_search_20250305\", \"name\": \"web_search\", "
                f"\"max_uses\": {settings.WEB_SEARCH_MAX_USES}}}],\n"
                if use_web_search else ""
            )
            + f")\n"
            f"text = ''.join(b.text for b in resp.content if b.type == 'text').strip()"
        ),
        "raw_response": None,
        "search_queries": [],
    }

    if settings.ANTHROPIC_API_KEY:
        try:
            text, raw, search_queries = _speech_with_claude(
                order, tier_config, duration, system_prompt, user_prompt,
                use_web_search=use_web_search,
            )
            record["raw_response"] = raw
            record["search_queries"] = search_queries
            return text, record
        except Exception as e:
            logger.warning(f"Claude speech failed ({e}), falling back to placeholder")
    text = _speech_placeholder(order, duration)
    record["placeholder_used"] = True
    return text, record


def _build_speech_prompts(order, duration: int, use_web_search: bool = False):
    """Тонкий делегат: system_prompt берём из промт-модуля типа презентации
    (school_essay/presentation/academic), user_prompt собираем здесь — он одинаков
    у всех типов (Тема + Тип + параметры + revision_hint + custom_part).
    """
    from generation.prompts import get_prompt_module
    from generation.prompts._shared import (
        build_revision_hint_speech, build_custom_part_speech,
    )

    pm = get_prompt_module(order.work_type)
    system_prompt = pm.build_speech_system_prompt(order, duration, use_web_search)

    presenter_line = ""
    if order.presenter_name or order.presenter_role:
        presenter_line = (
            f"Докладчик: {order.presenter_name or '—'}"
            f"{', ' + order.presenter_role if order.presenter_role else ''}\n"
        )

    user_prompt = (
        f"Тема: {order.topic}\n"
        f"{presenter_line}"
        f"Тип презентации: {order.work_type or '—'}\n"
        f"Учебное заведение / организация: {order.university or '—'}\n"
        f"Тезис/гипотеза: {order.thesis or '—'}\n"
        f"Длительность: {duration} минут\n"
        f"Детальность: {order.detail_level or 'standard'}"
        f"{build_custom_part_speech(order)}"
        f"{build_revision_hint_speech(order)}\n\n"
        "Напиши полный текст выступления в Markdown. Без вводных фраз — сразу текст."
    )
    return system_prompt, user_prompt


def _speech_with_claude(
    order, tier_config, duration: int, system_prompt: str, user_prompt: str,
    use_web_search: bool = False,
):
    """Возвращает (text, raw_text, search_queries).

    При use_web_search=True подключаем server-side web_search_20250305 — Anthropic
    сам гоняет цикл поиска и возвращает финальный ответ. Из response.content надо
    забрать ТОЛЬКО text-блоки (там же ещё server_tool_use и web_search_tool_result).
    """
    client = _get_anthropic_client()
    _model = tier_config.get("model", "claude-sonnet-4-6")

    kwargs = dict(
        model=_model,
        max_tokens=16000,
        temperature=0.7,
        system=system_prompt,
        messages=[{"role": "user", "content": user_prompt}],
    )
    if use_web_search:
        kwargs["tools"] = [{
            "type": "web_search_20250305",
            "name": "web_search",
            "max_uses": settings.WEB_SEARCH_MAX_USES,
        }]

    response = client.messages.create(**_messages_kwargs(**kwargs))

    if response.stop_reason == "max_tokens":
        logger.warning(
            f"Speech for order {order.id} hit max_tokens cap (duration={duration}m) — output truncated"
        )

    # Когда тулзы НЕ использовались — content[0].text как раньше. С тулзами content
    # содержит несколько блоков: server_tool_use (запросы поиска), web_search_tool_result
    # (результаты), text (финальный ответ). Собираем все text-блоки в порядке.
    text_parts = []
    search_queries = []
    for block in response.content:
        block_type = getattr(block, "type", None)
        if block_type == "text":
            text_parts.append(block.text)
        elif block_type == "server_tool_use" and getattr(block, "name", None) == "web_search":
            query = (getattr(block, "input", {}) or {}).get("query")
            if query:
                search_queries.append(query)

    raw = "".join(text_parts).strip()
    if use_web_search:
        logger.info(
            f"Speech for order {order.id} used web_search: {len(search_queries)} queries — {search_queries}"
        )
    return raw, raw, search_queries


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
