"""Channel adapters for publishing approved drafts.

Each product declares its channels in brands/<product>/channels.json.
Every channel type falls back gracefully: the default "manual" adapter just
prints what to copy where, so publishing works before any API is wired up.

Adapter contract: publish(asset_text, item_meta, config) -> detail string.
Raises ChannelError on failure; the publish command records per-channel status.
"""

import json
import re
from pathlib import Path

import httpx


class ChannelError(Exception):
    pass


def _require(config: dict, key: str, channel: str) -> str:
    value = config.get(key)
    if not value:
        raise ChannelError(f"channels.json: '{channel}' adapter needs '{key}'")
    return value


def _api_key(config: dict, channel: str) -> str:
    import os
    env = _require(config, "api_key_env", channel)
    key = os.environ.get(env)
    if not key:
        raise ChannelError(f"env var {env} is not set (needed by '{channel}')")
    return key


def _post(url: str, *, headers: dict, payload: dict) -> dict:
    try:
        resp = httpx.post(url, headers=headers, json=payload, timeout=30)
        resp.raise_for_status()
        return resp.json() if resp.content else {}
    except httpx.HTTPStatusError as e:
        raise ChannelError(f"{url} -> {e.response.status_code}: {e.response.text[:300]}")
    except httpx.HTTPError as e:
        raise ChannelError(f"{url} -> {e}")


# --- generic adapters -------------------------------------------------------

def publish_manual(text: str, meta: dict, config: dict) -> str:
    print("\n----- MANUAL PUBLISH: copy the asset below -----\n")
    print(text)
    print("\n----- end of asset -----")
    return "printed for manual publishing"


def publish_dir(text: str, meta: dict, config: dict) -> str:
    """Blog via git: write the post into a content directory you commit/deploy."""
    dest_dir = Path(_require(config, "path", "dir")).expanduser()
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / f"{meta['slug']}.md"
    dest.write_text(text)
    return f"wrote {dest} — commit and deploy with your usual flow"


def publish_webhook(text: str, meta: dict, config: dict) -> str:
    """Escape hatch for any CMS/tool that accepts a POST."""
    url = _require(config, "url", "webhook")
    _post(url, headers=config.get("headers", {}), payload={
        "product": meta["product"],
        "slug": meta["slug"],
        "channel": meta["channel"],
        "markdown": text,
    })
    return f"POSTed to {url}"


# --- social: Typefully ------------------------------------------------------

def _parse_x_thread(text: str) -> list[str]:
    """Pull the numbered tweets out of the social asset's '## X thread' section."""
    thread = _section(text, "X thread")
    if not thread:
        raise ChannelError("could not find an '## X thread' section in the social asset")
    tweets = re.findall(r"^\d+[\.\)]\s*(.+?)(?=^\d+[\.\)]|\Z)", thread, flags=re.M | re.S)
    return [t.strip() for t in tweets] if tweets else [thread.strip()]


def publish_browser_x(text: str, meta: dict, config: dict) -> str:
    """Post the X thread through a real browser, reusing a hand-saved session.

    config: {"type": "browser_x", "dry_run": bool?, "headed": bool?}. A channel
    'test' send forces dry_run via meta so it composes without posting.
    """
    from . import browser
    tweets = _parse_x_thread(text)
    if not browser.has_session("x"):
        raise ChannelError("no X login saved — run `python -m marketing_agent login x` once, "
                           "then post again")
    dry_run = bool(meta.get("dry_run") or config.get("dry_run"))
    shot = None
    slug = meta.get("slug")
    if slug:
        from .config import RUNS_DIR
        shot = RUNS_DIR / "jobs" / f"post-x-{slug}.png"
    try:
        detail = browser.post_to_x(
            tweets, dry_run=dry_run, headed=config.get("headed", True), screenshot=shot,
        )
    except browser.BrowserPosterError as e:
        raise ChannelError(str(e)) from None
    return detail + (f"; screenshot {shot}" if shot and shot.exists() else "")


def _parse_reddit_post(text: str) -> tuple[str, str]:
    """Pull (title, body) from the social asset's '## Reddit post' section."""
    section = _section(text, "Reddit post")
    if not section:
        raise ChannelError("could not find a '## Reddit post' section in the social asset")
    lines = section.strip().splitlines()
    title = ""
    body_start = 0
    for i, line in enumerate(lines):
        m = re.match(r"^\s*\**\s*title\s*\**\s*[:\-]\s*(.+)$", line, flags=re.I)
        if m:
            title = m.group(1).strip().strip("*").strip()
            body_start = i + 1
            break
    if not title:
        raise ChannelError("the '## Reddit post' section has no 'Title:' line")
    body = "\n".join(lines[body_start:]).strip()
    if not body:
        raise ChannelError("the '## Reddit post' section has a title but no body")
    return title, body


def publish_browser_reddit(text: str, meta: dict, config: dict) -> str:
    """Submit the Reddit post through a real browser, reusing a hand-saved session.

    config: {"type": "browser_reddit", "subreddit": str, "dry_run": bool?, "headed": bool?}.
    """
    from . import browser
    subreddit = str(config.get("subreddit", "")).strip()
    if not subreddit:
        raise ChannelError("this Reddit channel has no target subreddit set")
    if not browser.has_session("reddit"):
        raise ChannelError("no Reddit login saved — run `python -m marketing_agent login reddit` "
                           "once, then post again")
    title, body = _parse_reddit_post(text)
    dry_run = bool(meta.get("dry_run") or config.get("dry_run"))
    shot = None
    slug = meta.get("slug")
    if slug:
        from .config import RUNS_DIR
        shot = RUNS_DIR / "jobs" / f"post-reddit-{slug}.png"
    try:
        detail = browser.post_to_reddit(
            subreddit, title, body, dry_run=dry_run,
            headed=config.get("headed", True), screenshot=shot,
        )
    except browser.BrowserPosterError as e:
        raise ChannelError(str(e)) from None
    return detail + (f"; screenshot {shot}" if shot and shot.exists() else "")


def publish_typefully(text: str, meta: dict, config: dict) -> str:
    """Create a Typefully DRAFT of the X thread (you still hit publish there).

    The LinkedIn section has no comparable API and is printed for manual posting.
    """
    tweets = _parse_x_thread(text)
    # Typefully thread format: tweets separated by 4 newlines forcing splits.
    content = "\n\n\n\n".join(tweets)
    _post(
        "https://api.typefully.com/v1/drafts/",
        headers={"X-API-KEY": _api_key(config, "typefully")},
        payload={"content": content, "threadify": True},
    )
    linkedin = _section(text, "LinkedIn post")
    if linkedin:
        print("\n----- LinkedIn (manual — no API): -----\n" + linkedin.strip() + "\n-----")
    return "thread drafted in Typefully; LinkedIn printed for manual posting"


# --- newsletter: Resend -----------------------------------------------------

def publish_resend(text: str, meta: dict, config: dict) -> str:
    """Create a Resend broadcast DRAFT (review and send from the Resend UI)."""
    audience_id = _require(config, "audience_id", "resend")
    sender = _require(config, "from", "resend")
    subjects = re.findall(r"^(?:[-*]|\d+\.)\s*(.+)$", _section(text, "Subject lines") or "", flags=re.M)
    subject = subjects[0].strip('" ') if subjects else f"{meta['product']} newsletter"
    body = _section(text, "Body") or text
    _post(
        "https://api.resend.com/broadcasts",
        headers={"Authorization": f"Bearer {_api_key(config, 'resend')}"},
        payload={
            "audience_id": audience_id,
            "from": sender,
            "subject": subject,
            "html": _md_to_html(body),
        },
    )
    return f"broadcast drafted in Resend (subject: {subject!r}) — review and send there"


# --- helpers ----------------------------------------------------------------

def _section(markdown: str, heading: str) -> str | None:
    m = re.search(rf"^##\s+{re.escape(heading)}\s*$(.*?)(?=^##\s|\Z)", markdown, flags=re.M | re.S)
    return m.group(1) if m else None


def _md_to_html(md: str) -> str:
    """Minimal markdown -> HTML for newsletter bodies (paragraphs, links, bold)."""
    html = md.strip()
    html = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r'<a href="\2">\1</a>', html)
    html = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", html)
    paragraphs = [f"<p>{p.strip()}</p>" for p in html.split("\n\n") if p.strip()]
    return "\n".join(paragraphs)


ADAPTERS = {
    "manual": publish_manual,
    "dir": publish_dir,
    "webhook": publish_webhook,
    "typefully": publish_typefully,
    "browser_x": publish_browser_x,
    "browser_reddit": publish_browser_reddit,
    "resend": publish_resend,
}


def load_channels(product_dir: Path) -> dict:
    path = product_dir / "channels.json"
    if not path.exists():
        return {}
    return json.loads(path.read_text())
