"""Generate ONE channel's content on its own, as its own reviewable queue item.

Used by per-channel scheduling (blog weekly, LinkedIn every few days, X daily) and
by the manual "make this channel now" action. Each call produces one item, fact-checks
it, and — only when auto_publish is set AND the fact-check passes — approves and
publishes it to that channel's destinations. A failed fact-check always waits for a human.
"""

import datetime as dt
import json
import re
import shutil

from ..config import FACTCHECK_MODEL, QUEUE_DIR, RUNS_DIR, brand_dir, load_brand
from ..notify import notify
from ..runner import log_step, run_agent
from .weekly_content import _task_header

TARGETS = ("blog", "x", "linkedin", "reddit", "newsletter")
TARGET_CHANNEL = {"blog": "blog", "x": "social", "linkedin": "social",
                  "reddit": "social", "newsletter": "newsletter"}
CHANNEL_FILE = {"blog": "03-post.md", "social": "04-social.md", "newsletter": "05-newsletter.md"}
PLATFORM_SECTION = {"x": "X thread", "linkedin": "LinkedIn post", "reddit": "Reddit post"}


def _section(markdown: str, heading: str) -> str | None:
    m = re.search(rf"^##\s+{re.escape(heading)}\s*$(.*?)(?=^##\s|\Z)", markdown, flags=re.M | re.S)
    return m.group(1).strip() if m else None


def _latest_published_blog(product: str) -> str | None:
    items = sorted((QUEUE_DIR / "published").glob(f"*{product}*"), reverse=True)
    for item in items:
        post = item / "03-post.md"
        if post.exists():
            return post.read_text()
    return None


def _recent_platform_posts(product: str, platform: str, limit: int = 2) -> list[str]:
    """Recent same-platform post bodies, so a daily cadence doesn't repeat itself."""
    heading = PLATFORM_SECTION[platform]
    out = []
    for state in ("published", "approved", "pending"):
        for item in sorted((QUEUE_DIR / state).glob(f"*{product}*"), reverse=True):
            manifest = item / "manifest.json"
            if not manifest.exists():
                continue
            m = json.loads(manifest.read_text())
            if m.get("target") != platform:
                continue
            asset = item / "04-social.md"
            if asset.exists():
                sec = _section(asset.read_text(), heading)
                if sec:
                    out.append(sec)
            if len(out) >= limit:
                return out
    return out


async def _generate_asset(product, target, header, model):
    """Return (asset_text, extra_run_files) for the target's channel asset."""
    if target == "blog":
        brief = await run_agent("research", header + "Produce a short opportunities brief for one blog post.",
                                model=model, allow_web=True)
        seo = await run_agent("seo", header + "Opportunities brief:\n\n" + brief.text +
                              "\n\nNo Search Console data provided.", model=model, allow_web=True)
        post = await run_agent("writer", header + "Content brief:\n\n" + seo.text, model=model)
        return post.text, [("01-brief.md", brief.text), ("02-seo-brief.md", seo.text), (CHANNEL_FILE["blog"], post.text)], [brief, seo, post]

    if target in ("x", "linkedin", "reddit"):
        ctx = []
        blog = _latest_published_blog(product)
        if blog:
            ctx.append("Most recent published blog post:\n\n" + blog[:4000])
        recent = _recent_platform_posts(product, target)
        if recent:
            ctx.append("Recent posts already made on this platform (do NOT repeat their angle/opening):\n\n"
                       + "\n\n---\n\n".join(recent))
        context = "\n\n".join(ctx) if ctx else "No prior posts yet — ground the post in the brand brain."
        asset = await run_agent("standalone_social",
                                header + f"Platform: {target}\n\n# Context\n\n{context}\n\n"
                                f"Write the {target} post now, using the exact section heading.",
                                model=model)
        return asset.text, [(CHANNEL_FILE["social"], asset.text)], [asset]

    # newsletter
    blog = _latest_published_blog(product)
    src = ("Blog post:\n\n" + blog) if blog else "No blog post available; base it on the brand brain."
    email = await run_agent("email", header + src, model=model)
    return email.text, [(CHANNEL_FILE["newsletter"], email.text)], [email]


async def generate(product: str, target: str, *, instructions: str | None = None,
                   auto_publish: bool = False, model: str | None = None) -> None:
    if target not in TARGETS:
        raise SystemExit(f"Unknown target '{target}'. Options: {', '.join(TARGETS)}")
    brain = load_brand(product)
    date = dt.date.today().isoformat()
    run_dir = RUNS_DIR / date / product
    run_dir.mkdir(parents=True, exist_ok=True)
    header = _task_header(product, date, brain, instructions)
    channel = TARGET_CHANNEL[target]

    print(f"[1/2] writing {target}…")
    asset_text, files, steps = await _generate_asset(product, target, header, model)
    for s in steps:
        log_step(run_dir, s)  # cost log only; the queue item below holds the canonical assets

    # Build the queue item (one per target per day).
    slug = f"{date}-{product}-{target}"
    item_dir = QUEUE_DIR / "pending" / slug
    if item_dir.exists():
        shutil.rmtree(item_dir)
    item_dir.mkdir(parents=True)
    for name, text in files:
        (item_dir / name).write_text(text + "\n")

    print("[2/2] fact-check…")
    fc = await run_agent("factcheck", header + f"Drafts to check:\n\n## {channel.upper()}\n\n{asset_text}",
                         model=FACTCHECK_MODEL)
    (item_dir / "06-factcheck.md").write_text(fc.text + "\n")
    log_step(run_dir, fc)
    passed = "VERDICT: PASS" in fc.text

    manifest = {
        "product": product, "date": date, "target": target, "channels": [channel],
        "files": [n for n, _ in files if n in CHANNEL_FILE.values()],
        "factcheck": "PASS" if passed else "FAIL", "approved": False,
        "auto_publish": bool(auto_publish),
    }
    if channel == "social":
        manifest["platform"] = target
    (item_dir / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")

    print(f"\nDone. {target} draft ready — fact-check: {'PASS' if passed else 'FAIL'}")

    if auto_publish and passed:
        from ..approve import approve
        from ..publish import publish
        print("auto-publish is on and the fact-check passed — approving and publishing…")
        approve(slug, yes=True, by="schedule")
        publish(slug)
    else:
        reason = "waiting for your review" if not auto_publish else "fact-check failed — held for review"
        notify(f"[{product}] scheduled {target} draft ready ({reason}): queue/pending/{slug}/")
