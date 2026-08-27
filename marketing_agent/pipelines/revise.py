"""Operate on a pending queue item after generation.

revise():  apply operator feedback — rewrite the post, re-derive social +
           newsletter, re-run the fact-check, update the item in place.
recheck(): re-run only the fact-check (after manual edits to the drafts).

Both treat the queue item as canonical (that's what gets published) and log
costs to the item's original run dir under runs/<date>/<product>/.
"""

import asyncio
import datetime as dt
import json

from ..config import FACTCHECK_MODEL, QUEUE_DIR, RUNS_DIR, load_brand
from ..notify import notify
from ..runner import log_step, run_agent
from .weekly_content import _task_header


def _load_item(slug: str):
    item_dir = QUEUE_DIR / "pending" / slug
    if not item_dir.is_dir():
        raise SystemExit(f"No pending item '{slug}'. See: python -m marketing_agent queue")
    manifest = json.loads((item_dir / "manifest.json").read_text())
    return item_dir, manifest


def _run_dir(manifest: dict):
    run_dir = RUNS_DIR / manifest["date"] / manifest["product"]
    run_dir.mkdir(parents=True, exist_ok=True)
    return run_dir


def _factcheck_prompt(header: str, post: str, social: str, email: str) -> str:
    return (
        header
        + "Drafts to check:\n\n## BLOG POST\n\n" + post
        + "\n\n## SOCIAL\n\n" + social
        + "\n\n## NEWSLETTER\n\n" + email
    )


async def _factcheck(item_dir, manifest, header: str, model: str | None = None) -> bool:
    post = (item_dir / "03-post.md").read_text()
    social = (item_dir / "04-social.md").read_text()
    email = (item_dir / "05-newsletter.md").read_text()
    fc = await run_agent(
        "factcheck", _factcheck_prompt(header, post, social, email),
        model=model or FACTCHECK_MODEL,
    )
    (item_dir / "06-factcheck.md").write_text(fc.text + "\n")
    log_step(_run_dir(manifest), fc)
    return "VERDICT: PASS" in fc.text


async def recheck(slug: str, model: str | None = None) -> None:
    """Re-run the fact-check on a pending item (e.g. after manual edits)."""
    item_dir, manifest = _load_item(slug)
    product = manifest["product"]
    header = _task_header(product, dt.date.today().isoformat(), load_brand(product))

    print("[1/1] fact-check…")
    passed = await _factcheck(item_dir, manifest, header, model)

    manifest["factcheck"] = "PASS" if passed else "FAIL"
    (item_dir / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"\nDone. Fact-check: {'PASS' if passed else 'FAIL'}")


async def revise(slug: str, feedback: str, model: str | None = None) -> None:
    """Rewrite a pending item according to operator feedback, then re-check."""
    if not feedback or not feedback.strip():
        raise SystemExit("Feedback is required for a revision.")
    item_dir, manifest = _load_item(slug)
    product = manifest["product"]
    header = _task_header(product, dt.date.today().isoformat(), load_brand(product))
    run_dir = _run_dir(manifest)
    old_post = (item_dir / "03-post.md").read_text()

    print("[1/3] revising post…")
    post = await run_agent(
        "writer",
        header
        + "Revise the blog post below according to the operator's feedback. "
        + "Apply the feedback precisely, keep everything that already works, and "
        + "return the complete revised post (not a diff or commentary).\n\n"
        + f"## Operator feedback\n\n{feedback.strip()}\n\n"
        + f"## Current blog post\n\n{old_post}",
        model=model,
    )
    (item_dir / "03-post.md").write_text(post.text + "\n")
    log_step(run_dir, post)

    print("[2/3] social + email…")
    feedback_note = (
        f"\n\nOperator feedback for this revision (apply where relevant):\n\n{feedback.strip()}"
    )
    social, email = await asyncio.gather(
        run_agent("social", header + "Blog post:\n\n" + post.text + feedback_note, model=model),
        run_agent("email", header + "Blog post:\n\n" + post.text + feedback_note, model=model),
    )
    (item_dir / "04-social.md").write_text(social.text + "\n")
    (item_dir / "05-newsletter.md").write_text(email.text + "\n")
    log_step(run_dir, social)
    log_step(run_dir, email)

    print("[3/3] fact-check…")
    passed = await _factcheck(item_dir, manifest, header)

    manifest["factcheck"] = "PASS" if passed else "FAIL"
    manifest["approved"] = False
    manifest["revising"] = False
    manifest.setdefault("revisions", []).append({
        "at": dt.datetime.now(dt.timezone.utc).isoformat(),
        "feedback": feedback.strip(),
    })
    (item_dir / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")

    print(f"\nDone. Fact-check: {'PASS' if passed else 'FAIL'}")
    notify(f"[{product}] revised drafts ready for review — fact-check "
           f"{'PASS' if passed else 'FAIL'}: queue/pending/{slug}/")
