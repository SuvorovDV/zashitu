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
        print("usage: bench_gen.py <fixture_dir> <output_dir>", file=sys.stderr)
        sys.exit(2)

    fixture_dir = Path(sys.argv[1])
    output_dir = Path(sys.argv[2])
    output_dir.mkdir(parents=True, exist_ok=True)

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

    summary = {
        "fixture": fixture_dir.name,
        "model": cp.get("model"),
        "stop_reason": cp.get("stop_reason"),
        "fallback_reason": cp.get("fallback_reason"),
        "layouts": [s.get("layout") for s in plan.get("slides", [])],
        "titles": [s.get("title") for s in plan.get("slides", [])],
        "has_source_ref": [bool(s.get("source_ref")) for s in plan.get("slides", [])],
    }
    (output_dir / "summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    print(f"pptx:    {dst_pptx}")
    print(f"layouts: {summary['layouts']}")
    print(f"source_ref coverage: {sum(summary['has_source_ref'])}/{len(summary['layouts'])}")


if __name__ == "__main__":
    main()
