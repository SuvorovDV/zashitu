"""Bench runner: one fixture -> one .pptx + slide_plan.json.

Runs INSIDE the worker container (docker exec). Uses seeded speech,
so only slide-generation Claude call is made (1 API hit, ~$0.24 on premium).

Usage (on VM):
    docker cp scripts/bench_gen.py deploy-worker-1:/tmp/
    docker cp bench/fixtures/<name>/ deploy-worker-1:/tmp/fixture/
    docker exec deploy-worker-1 python /tmp/bench_gen.py /tmp/fixture /tmp/bench_out
    docker cp deploy-worker-1:/tmp/bench_out ./bench/<baseline_or_after>/<name>/
"""
import json
import shutil
import sys
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, "/app")

from generation.tasks import _pptxgenjs_generator  # noqa: E402
from config import TIERS, settings  # noqa: E402


def main():
    if len(sys.argv) < 3:
        print(
            "usage: bench_gen.py <fixture_dir> <output_dir> [--user-speech] [--enhance]",
            file=sys.stderr,
        )
        sys.exit(2)

    fixture_dir = Path(sys.argv[1])
    output_dir = Path(sys.argv[2])
    output_dir.mkdir(parents=True, exist_ok=True)

    flags = set(sys.argv[3:])
    user_speech = "--user-speech" in flags
    enhance = "--enhance" in flags
    # --tier=premium|standard|basic переопределяет тариф fixture'а.
    tier_override = next((f.split("=", 1)[1] for f in flags if f.startswith("--tier=")), None)

    order_data = json.loads((fixture_dir / "order.json").read_text(encoding="utf-8"))
    speech_text = (fixture_dir / "speech.md").read_text(encoding="utf-8")

    defaults = {
        "required_elements": None,
        "speech_revision_note": None,
        "slides_revision_note": None,
        "speech_text": speech_text,
        "speech_revisions": 0,
        "slides_revisions": 0,
        "slides_approved": False,
        "output_filename": None,
        "status": "generating",
    }
    for k, v in defaults.items():
        order_data.setdefault(k, v)

    # CLI-флаги переопределяют fixture order.json — удобно прогонять одну fixture
    # под разными конфигурациями (strict/enhance × user-speech/gen-speech × tier).
    order_data["speech_is_user_provided"] = user_speech
    order_data["user_speech_text"] = speech_text if user_speech else None
    order_data["allow_enhance"] = enhance
    if tier_override:
        order_data["tier"] = tier_override

    order = SimpleNamespace(**order_data)
    tier_config = TIERS[order.tier]

    print(f"fixture: {fixture_dir.name}")
    print(f"topic:   {order.topic}")
    print(f"model:   {tier_config['model']}  tier: {order.tier}")
    print(f"speech:  {len(speech_text)} chars (seeded)")
    print(f"api_key: {'set' if settings.ANTHROPIC_API_KEY else 'MISSING'}")
    print()

    output_filename, prompt_json = _pptxgenjs_generator(order, None, tier_config)

    src = Path("/app") / settings.OUTPUT_DIR / output_filename
    dst_pptx = output_dir / "deck.pptx"
    shutil.copy(src, dst_pptx)

    (output_dir / "generation.json").write_text(prompt_json, encoding="utf-8")

    d = json.loads(prompt_json)
    plan = d.get("slide_plan", {})
    cp = d.get("claude_prompt", {})

    slides = plan.get("slides", [])
    source_refs = [s.get("source_ref") or "" for s in slides]
    enhanced = sum(1 for r in source_refs if "общее знание" in r.lower())
    summary = {
        "fixture": fixture_dir.name,
        "config": {
            "user_speech": user_speech,
            "enhance": enhance,
            "tier": order.tier,
        },
        "model": cp.get("model"),
        "stop_reason": cp.get("stop_reason"),
        "fallback_reason": cp.get("fallback_reason"),
        "layouts": [s.get("layout") for s in slides],
        "titles": [s.get("title") for s in slides],
        "source_refs": source_refs,
        "enhanced_count": enhanced,
    }
    (output_dir / "summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    print(f"pptx:    {dst_pptx}")
    print(f"config:  user_speech={user_speech}, enhance={enhance}")
    print(f"layouts: {summary['layouts']}")
    print(f"source_ref: {sum(1 for r in source_refs if r)}/{len(slides)} filled, {enhanced} enhanced (общее знание)")


if __name__ == "__main__":
    main()
