"""Локальный прогон генерации без БД и UI — для демо/отладки.

Запуск (на prod worker или локально с ANTHROPIC_API_KEY в .env):
  docker exec deploy-worker-1 python /app/generation/_standalone_demo.py

Пишет /tmp/out_speech.md и /tmp/out.pptx внутри контейнера.
"""
import json
import shutil
import sys
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, "/app")

from generation.tasks import _generate_speech, _pptxgenjs_generator  # noqa: E402
from config import TIERS, settings  # noqa: E402


def main():
    order = SimpleNamespace(
        id="standalone-demo",
        topic="Анализ динамики цен на жильё в российских регионах 2020–2025",
        direction="Региональная экономика",
        work_type="Курсовая",
        duration_minutes=12,
        slides_count=None,
        detail_level="detailed",
        thesis=(
            "Рост цен на жильё в 2020–2025 годах был неоднородным: мегаполисы "
            "(Москва, Санкт-Петербург, Казань) продемонстрировали двузначный "
            "ежегодный рост, тогда как средние и малые города стагнировали. "
            "Ключевые драйверы: льготная ипотека, дефицит предложения, миграция "
            "населения."
        ),
        university="МГУ им. М.В. Ломоносова",
        required_elements=None,
        mode="no_template",
        palette="ocean_gradient",
        tier="premium",
        status="generating",
        custom_elements=None,
        speech_revision_note=None,
        slides_revision_note=None,
        presenter_name="Алексей Иванов",
        presenter_role="студент-магистр",
        skip_tech_details=False,
        include_speech=True,
        speech_text=None,
        speech_approved=True,
        speech_revisions=0,
        slides_revisions=0,
        slides_approved=False,
        output_filename=None,
    )
    tier_config = TIERS["premium"]

    print(f"ANTHROPIC_API_KEY set: {bool(settings.ANTHROPIC_API_KEY)}")
    print(f"Model: {tier_config['model']}")
    print(f"Tier: {order.tier}, palette: {order.palette}, detail: {order.detail_level}")
    print()

    seed = Path("/tmp/seed_speech.md")
    if seed.exists():
        speech_text = seed.read_text(encoding="utf-8")
        print(f"== Speech (seeded from {seed}) ==  chars: {len(speech_text)}")
        # Меняем topic на тот, под который речь написана — чтобы промпт не рассинхронизировался.
        if "Кузбасс" in speech_text or "Кемеров" in speech_text:
            order.topic = "Проблемы развития рынка труда 2020–2025 годов в Кузбассе"
            order.direction = "Рынок труда, региональная экономика"
    else:
        print("== Speech ==")
        speech_text, speech_rec = _generate_speech(order, tier_config)
        print(f"  speech chars: {len(speech_text)}")
        print(f"  stop_reason: {speech_rec.get('raw_response') and 'ok' or 'placeholder'}")
    order.speech_text = speech_text
    Path("/tmp/out_speech.md").write_text(speech_text, encoding="utf-8")
    print()

    print("== Slides ==")
    output_filename, prompt_json = _pptxgenjs_generator(order, None, tier_config)
    src = Path("/app") / settings.OUTPUT_DIR / output_filename
    shutil.copy(src, "/tmp/out.pptx")
    d = json.loads(prompt_json)
    cp = d.get("claude_prompt", {})
    plan = d.get("slide_plan", {})
    print(f"  pptx file: {output_filename}")
    print(f"  stop_reason: {cp.get('stop_reason')}")
    print(f"  fallback_reason: {cp.get('fallback_reason')}")
    print(f"  image_generation: {json.dumps(cp.get('image_generation'), ensure_ascii=False)}")
    print(f"  layouts: {[s.get('layout') for s in plan.get('slides', [])]}")
    print(f"  titles: {[s.get('title') for s in plan.get('slides', [])]}")


if __name__ == "__main__":
    main()
