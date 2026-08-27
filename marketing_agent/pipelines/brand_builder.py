"""Draft a new product's brand brain from a plain-language description.

Run: python -m marketing_agent brandgen <product> --description "..."

The brand folder must already exist (copied from brands/_template). Every file
the agent returns is parsed out of one delimited response and written over the
template copy; files it can't know get TODO(user) markers for the dashboard's
open-questions tracker.
"""

import datetime as dt
import re

from ..config import RUNS_DIR, brand_dir
from ..runner import log_step, run_agent

GENERATED_FILES = (
    "features.md", "positioning.md", "icp.md", "voice.md",
    "pricing.md", "never-say.md", "competitors.md",
)


async def run(product: str, description: str, model: str | None = None) -> None:
    if not description or not description.strip():
        raise SystemExit("A product description is required.")
    brand = brand_dir(product)  # raises with a helpful error if missing

    template_blocks = "\n\n".join(
        f"===== TEMPLATE: {name} =====\n{(brand / name).read_text()}"
        for name in GENERATED_FILES if (brand / name).exists()
    )

    print("[1/1] drafting brand brain…")
    result = await run_agent(
        "brand_builder",
        f"Product slug: {product}\nDate: {dt.date.today().isoformat()}\n\n"
        f"# Product description (from the operator)\n\n{description.strip()}\n\n"
        f"# Template files (keep these structures)\n\n{template_blocks}",
        model=model,
    )

    run_dir = RUNS_DIR / dt.date.today().isoformat() / product
    run_dir.mkdir(parents=True, exist_ok=True)
    log_step(run_dir, result)

    blocks = re.split(r"^===== FILE: (\S+) =====\s*$", result.text, flags=re.M)
    # re.split yields [preamble, name1, content1, name2, content2, ...]
    written = []
    for name, content in zip(blocks[1::2], blocks[2::2]):
        if name not in GENERATED_FILES:
            print(f"  skipping unexpected file from agent: {name}")
            continue
        (brand / name).write_text(content.strip() + "\n")
        written.append(name)

    missing = [n for n in GENERATED_FILES if n not in written]
    print(f"wrote {len(written)} file(s) to brands/{product}/: {', '.join(written)}")
    if missing:
        print(f"agent did not return: {', '.join(missing)} (template copies kept)")

    todos = 0
    for name in GENERATED_FILES:
        path = brand / name
        if path.exists():
            todos += sum(1 for line in path.read_text().splitlines() if "TODO" in line)
    print(f"{todos} open question(s) marked TODO — answer them in the dashboard's Product info page")
