"""Quick local test of ner_validator against bench decks.

Runs against:
  1. bench/baseline/generation.json  — Path C baseline (smb_digital, rich source)
  2. bench/after/generation.json     — Path C after (same source)
  3. /tmp/bench_sparse_enhance_v2    — sonnet enhance on sparse
  4. /tmp/bench_sparse_opus          — opus enhance on sparse

Reports for each:
  - Total entities extracted from slides
  - Hallucinated entities (in slides but not in source)
  - False-positive candidates (manual inspection)
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from generation.ner_validator import extract_entities, validate_slides, summarize  # noqa: E402


def load_deck(generation_json_path: Path, speech_md_path: Path | None = None) -> tuple[list[dict], str]:
    data = json.loads(generation_json_path.read_text(encoding="utf-8"))
    plan = data.get("slide_plan", {})
    slides = plan.get("slides", [])
    # Source = ТОЛЬКО speech.md; claude_prompt.user содержит текст системных правил,
    # которые засоряют extract_entities капсами вроде «ПРАВИЛА», «ДОКЛАДЧИК».
    if speech_md_path and speech_md_path.exists():
        source = speech_md_path.read_text(encoding="utf-8")
    else:
        source = data.get("claude_prompt", {}).get("user", "")
    return slides, source


def report(name: str, slides: list[dict], source: str) -> None:
    print(f"\n=== {name} ===")
    print(f"  slides: {len(slides)}")
    print(f"  source length: {len(source)} chars")

    source_ents = extract_entities(source)
    print(f"  source entities: {len(source_ents)}")
    if len(source_ents) <= 25:
        print(f"    {sorted(source_ents)}")

    all_slide_ents: set[str] = set()
    for s in slides:
        text_parts: list[str] = []
        for k in ("title", "subtitle", "callout", "quote", "intro"):
            if isinstance(s.get(k), str):
                text_parts.append(s[k])
        for k in ("bullets", "labels", "headers"):
            if isinstance(s.get(k), list):
                text_parts.extend(str(x) for x in s[k] if x)
        all_slide_ents.update(extract_entities(" ".join(text_parts)))
    print(f"  slide entities: {len(all_slide_ents)}")

    halluc = validate_slides(slides, source)
    if halluc:
        print(f"  HALLUCINATED: {len(halluc)} across {len({h['slide_idx'] for h in halluc})} slides")
        for h in halluc[:15]:
            print(f"    slide {h['slide_idx']+1} [{h['layout']}]: {h['entity']!r}")
        if len(halluc) > 15:
            print(f"    ... ({len(halluc) - 15} more)")
    else:
        print("  HALLUCINATED: 0 ✓")


ROOT = Path(__file__).parent.parent

# Sanity-check: при явно подложенных галлюцинациях валидатор их ловит.
fake_source = "Рынок труда в России растёт. Упоминается только ВШЭ и Росстат."
fake_slides = [
    {"layout": "stats", "intro": "По данным Росстата — 42,3 % занятых в секторе",
     "stats": [{"value": "42,3 %", "label": "занятость в секторе"}]},
    {"layout": "default", "bullets": [
        "В Прокопьевске безработица выросла до 14,5 %",
        "СУЭК и Распадская сократили штат на 3 000 человек",
        "По прогнозу к 2028 году рынок восстановится",
    ]},
    {"layout": "quote", "quote": "Цитата Владимира Путина: «рынок устойчив»",
     "attribution": "Владимир Путин"},
]
from generation.ner_validator import validate_slides as _validate  # noqa: E402
fake_halluc = _validate(fake_slides, fake_source)
print("=== sanity (mock deck w/ injected hallucinations) ===")
print(f"  expected: Прокопьевск, 14,5 %, СУЭК, Распадская, 3 000, 2028, Владимир Путин are all FAKE (not in source)")
for h in fake_halluc:
    print(f"  FLAG: slide {h['slide_idx']+1} [{h['layout']}]: {h['entity']!r}")
print(f"  detection: {len(fake_halluc)} flagged — should be ≥5 for validator to be useful")
print()


# Local bench artifacts
report(
    "baseline (Path C before, rich source)",
    *load_deck(ROOT / "bench/baseline/generation.json",
               ROOT / "bench/fixtures/smb_digital/speech.md"),
)
report(
    "after (Path C after, rich source)",
    *load_deck(ROOT / "bench/after/generation.json",
               ROOT / "bench/fixtures/smb_digital/speech.md"),
)

# Sparse decks — saved locally
for name, path, speech in [
    ("sparse_enhance_sonnet (sonnet, sparse+enhance)", ROOT / "bench/sparse_enhance_sonnet.json",
     ROOT / "bench/fixtures/sparse_ai/speech.md"),
    ("sparse_enhance_opus (opus, sparse+enhance)", ROOT / "bench/sparse_enhance_opus.json",
     ROOT / "bench/fixtures/sparse_ai/speech.md"),
]:
    if path.exists():
        report(name, *load_deck(path, speech))
    else:
        print(f"\n=== {name} === SKIP (not found at {path})")
