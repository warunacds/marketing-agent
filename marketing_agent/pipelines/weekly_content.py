"""Weekly content pipeline: brief -> SEO brief -> post -> social + email
-> fact-check -> approval queue.

Run: python -m marketing_agent content --product <slug> [--model <id>]
"""

import asyncio
import datetime as dt
import json
import shutil

from ..config import FACTCHECK_MODEL, QUEUE_DIR, RUNS_DIR, load_brand
from ..runner import log_step, run_agent


def _task_header(product: str, date: str, brain: str) -> str:
    return (
        f"Product: {product}\n"
        f"Date: {date}\n\n"
        f"# Brand brain\n\n{brain}\n\n"
        f"# Task\n\n"
    )


async def run(product: str, gsc_data: str | None = None, model: str | None = None) -> None:
    brain = load_brand(product)  # validates the product exists
    date = dt.date.today().isoformat()
    run_dir = RUNS_DIR / date / product
    run_dir.mkdir(parents=True, exist_ok=True)
    header = _task_header(product, date, brain)

    def save(name: str, text: str) -> None:
        (run_dir / name).write_text(text + "\n")
        print(f"  wrote runs/{date}/{product}/{name}")

    # 1. Research: weekly opportunities brief (needs the web).
    print("[1/6] research…")
    brief = await run_agent(
        "research",
        header + "Produce this week's opportunities brief.",
        model=model,
        allow_web=True,
    )
    save("01-brief.md", brief.text)
    log_step(run_dir, brief)

    # 2. SEO: pick the best idea, write a content brief.
    gsc_section = (
        f"\n\nSearch Console data:\n{gsc_data}" if gsc_data
        else "\n\nNo Search Console data provided this week."
    )
    print("[2/6] seo…")
    seo = await run_agent(
        "seo",
        header + "Opportunities brief:\n\n" + brief.text + gsc_section,
        model=model,
        allow_web=True,
    )
    save("02-seo-brief.md", seo.text)
    log_step(run_dir, seo)

    # 3. Writer: full post from the brief.
    print("[3/6] writer…")
    post = await run_agent("writer", header + "Content brief:\n\n" + seo.text, model=model)
    save("03-post.md", post.text)
    log_step(run_dir, post)

    # 4. Social + email derive from the same post — run them concurrently.
    print("[4/6] social + email…")
    social, email = await asyncio.gather(
        run_agent("social", header + "Blog post:\n\n" + post.text, model=model),
        run_agent("email", header + "Blog post:\n\n" + post.text, model=model),
    )
    save("04-social.md", social.text)
    save("05-newsletter.md", email.text)
    log_step(run_dir, social)
    log_step(run_dir, email)

    # 5. Fact-check gate: every claim vs features.md, on a cheap model.
    print("[5/6] fact-check…")
    factcheck = await run_agent(
        "factcheck",
        header
        + "Drafts to check:\n\n## BLOG POST\n\n" + post.text
        + "\n\n## SOCIAL\n\n" + social.text
        + "\n\n## NEWSLETTER\n\n" + email.text,
        model=FACTCHECK_MODEL,
    )
    save("06-factcheck.md", factcheck.text)
    log_step(run_dir, factcheck)
    passed = "VERDICT: PASS" in factcheck.text

    # 6. Stage everything in the approval queue. Nothing publishes from here
    #    without `python -m marketing_agent approve`.
    print("[6/6] queueing for approval…")
    slug = f"{date}-{product}"
    item_dir = QUEUE_DIR / "pending" / slug
    if item_dir.exists():
        shutil.rmtree(item_dir)
    shutil.copytree(run_dir, item_dir, ignore=shutil.ignore_patterns("costs.jsonl"))
    (item_dir / "manifest.json").write_text(json.dumps({
        "product": product,
        "date": date,
        "factcheck": "PASS" if passed else "FAIL",
        "files": ["03-post.md", "04-social.md", "05-newsletter.md"],
        "approved": False,
    }, indent=2) + "\n")

    total = sum(
        json.loads(line).get("cost_usd") or 0
        for line in (run_dir / "costs.jsonl").read_text().splitlines()
    )
    print(f"\nDone. Fact-check: {'PASS' if passed else 'FAIL — review 06-factcheck.md before approving'}")
    print(f"Drafts: queue/pending/{slug}/   (total cost ~${total:.2f})")
    print(f"Review, then: python -m marketing_agent approve {slug}")
