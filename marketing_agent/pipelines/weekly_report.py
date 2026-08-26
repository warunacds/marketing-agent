"""Weekly analyst: report on what worked, append lessons to the brand brain.

Run: python -m marketing_agent report --product <slug> [--metrics file.md]
"""

import datetime as dt
import re

from ..config import DEFAULT_MODEL, RUNS_DIR, brand_dir
from ..runner import log_step, run_agent


async def run(product: str, metrics_file: str | None = None) -> None:
    brand = brand_dir(product)
    date = dt.date.today().isoformat()
    run_dir = RUNS_DIR / date / product
    run_dir.mkdir(parents=True, exist_ok=True)

    if metrics_file:
        from pathlib import Path
        metrics = "Metrics provided:\n\n" + Path(metrics_file).read_text()
    else:
        metrics = (
            "No metrics were provided this week. Base the report on production "
            "stats visible under runs/ and queue/ for this product."
        )

    result = await run_agent(
        "analyst",
        f"Product: {product}\nDate: {date}\n"
        f"Brand folder: brands/{product}/ — read every file in it first.\n"
        f"Past runs live under runs/, approvals under queue/.\n\n{metrics}",
    )
    (run_dir / "report.md").write_text(result.text + "\n")
    log_step(run_dir, result, DEFAULT_MODEL)
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
