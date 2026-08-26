"""Weekly analyst: report on what worked, append lessons to the brand brain.

Run: python -m marketing_agent report --product <slug> [--metrics file.md] [--model <id>]
"""

import asyncio
import datetime as dt
import json
import re
from pathlib import Path

from ..config import QUEUE_DIR, RUNS_DIR, brand_dir, load_brand
from ..runner import log_step, run_agent


def _production_stats(product: str) -> str:
    """Summarize queue state and recent reports so the analyst can see them."""
    lines = ["## Queue state"]
    for state in ("pending", "approved", "rejected"):
        for item in sorted((QUEUE_DIR / state).iterdir()):
            if not item.is_dir() or product not in item.name:
                continue
            manifest = item / "manifest.json"
            m = json.loads(manifest.read_text()) if manifest.exists() else {}
            lines.append(
                f"- {state}: {item.name} (fact-check: {m.get('factcheck', '?')}"
                + (f", reason: {m['reason']}" if m.get("reason") else "")
                + ")"
            )
    reports = sorted(RUNS_DIR.glob(f"*/{product}/report.md"))[-3:]
    for r in reports:
        lines.append(f"\n## Past report ({r.parent.parent.name})\n\n{r.read_text().strip()}")
    return "\n".join(lines)


async def run(product: str, metrics_file: str | None = None, model: str | None = None) -> None:
    brand = brand_dir(product)
    brain = load_brand(product)
    date = dt.date.today().isoformat()
    run_dir = RUNS_DIR / date / product
    run_dir.mkdir(parents=True, exist_ok=True)

    if metrics_file:
        metrics = "Metrics provided:\n\n" + Path(metrics_file).read_text()
    else:
        metrics = (
            "No metrics were provided this week. Base the report on the "
            "production stats below."
        )

    result = await run_agent(
        "analyst",
        f"Product: {product}\nDate: {date}\n\n"
        f"# Brand brain\n\n{brain}\n\n"
        f"# Production stats\n\n{_production_stats(product)}\n\n"
        f"# Task\n\n{metrics}",
        model=model,
    )
    (run_dir / "report.md").write_text(result.text + "\n")
    log_step(run_dir, result)
    print(f"wrote runs/{date}/{product}/report.md")

    # Append the report's Lessons bullets to the brand brain, where the writer
    # and social agents will read them next week.
    lessons = re.findall(r"^- \*\*.+$", result.text, flags=re.MULTILINE)
    if lessons:
        learnings = brand / "learnings.md"
        existing = learnings.read_text() if learnings.exists() else "# Learnings\n"
        head, _, tail = existing.partition("\n")
        learnings.write_text(head + "\n\n" + "\n".join(lessons) + "\n" + tail.lstrip("\n"))
        print(f"appended {len(lessons)} lesson(s) to brands/{product}/learnings.md")
    else:
        print("no lessons found in report — learnings.md unchanged")
