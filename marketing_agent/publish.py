"""Publish an approved queue item through its product's configured channels.

Each channel (blog / social / newsletter) may have ONE destination or a LIST of
them — e.g. social posting to X, Reddit, and a manual copy at once. Every
destination publishes and is tracked independently, so a re-publish retries only
the ones that haven't succeeded.
"""

import datetime as dt
import json

from .channels import ADAPTERS, ChannelError, load_channels
from .config import QUEUE_DIR, brand_dir

CHANNEL_FILES = {
    "blog": "03-post.md",
    "social": "04-social.md",
    "newsletter": "05-newsletter.md",
}


def as_destinations(value) -> list[dict]:
    """Normalize a channel config (missing / single object / list) to a list."""
    if value is None:
        return [{"type": "manual"}]
    if isinstance(value, dict):
        return [value]
    if isinstance(value, list):
        return [d for d in value if isinstance(d, dict)] or [{"type": "manual"}]
    return [{"type": "manual"}]


def _prior_receipts(value, n: int) -> list:
    """Existing published receipts for a channel, normalized to a list of length n."""
    if isinstance(value, list):
        receipts = list(value)
    elif isinstance(value, dict):
        receipts = [value]  # legacy single-destination receipt
    else:
        receipts = []
    receipts += [None] * (n - len(receipts))
    return receipts[:n]


def _label(config: dict) -> str:
    t = config.get("type", "manual")
    if t == "browser_reddit" and config.get("subreddit"):
        return f"browser_reddit r/{config['subreddit']}"
    return t


def publish(slug: str, only_channels: list[str] | None = None) -> None:
    item_dir = QUEUE_DIR / "approved" / slug
    if not item_dir.is_dir():
        raise SystemExit(
            f"No approved item '{slug}'. Approve it first: python -m marketing_agent approve {slug}"
        )
    manifest = json.loads((item_dir / "manifest.json").read_text())
    product = manifest["product"]
    channels = load_channels(brand_dir(product))
    published = manifest.setdefault("published", {})

    targets = only_channels or list(CHANNEL_FILES)
    for channel in targets:
        if channel not in CHANNEL_FILES:
            raise SystemExit(f"Unknown channel '{channel}'. Options: {', '.join(CHANNEL_FILES)}")

        destinations = as_destinations(channels.get(channel))
        text = (item_dir / CHANNEL_FILES[channel]).read_text()
        receipts = _prior_receipts(published.get(channel), len(destinations))

        for i, config in enumerate(destinations):
            label = _label(config)
            if receipts[i] and receipts[i].get("status") == "ok":
                print(f"{channel} [{label}]: already published, skipping")
                continue
            adapter_name = config.get("type", "manual")
            adapter = ADAPTERS.get(adapter_name)
            if adapter is None:
                raise SystemExit(
                    f"channels.json: unknown adapter '{adapter_name}' for {channel}. "
                    f"Options: {', '.join(ADAPTERS)}"
                )
            meta = {"product": product, "slug": slug, "channel": channel, "index": i}
            try:
                detail = adapter(text, meta, config)
                receipts[i] = {
                    "type": adapter_name,
                    "label": label,
                    "status": "ok",
                    "at": dt.datetime.now(dt.timezone.utc).isoformat(),
                    "detail": detail,
                }
                print(f"{channel} [{label}]: {detail}")
            except ChannelError as e:
                receipts[i] = {"type": adapter_name, "label": label, "status": "error",
                               "detail": str(e)}
                print(f"{channel} [{label}]: FAILED — {e}")

        published[channel] = receipts

    (item_dir / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")

    def channel_done(channel: str) -> bool:
        expected = len(as_destinations(channels.get(channel)))
        receipts = published.get(channel)
        if not isinstance(receipts, list) or len(receipts) < expected:
            return False
        return all(r and r.get("status") == "ok" for r in receipts)

    if all(channel_done(c) for c in CHANNEL_FILES):
        item_dir.rename(QUEUE_DIR / "published" / slug)
        print(f"\nAll channels done -> queue/published/{slug}/")
    else:
        pending = [c for c in CHANNEL_FILES if not channel_done(c)]
        print(f"\nStill unpublished: {', '.join(pending)} (fix and re-run publish — done destinations are skipped)")
