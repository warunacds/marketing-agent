"""Publish an approved queue item through its product's configured channels."""

import datetime as dt
import json

from .channels import ADAPTERS, ChannelError, load_channels
from .config import QUEUE_DIR, brand_dir

CHANNEL_FILES = {
    "blog": "03-post.md",
    "social": "04-social.md",
    "newsletter": "05-newsletter.md",
}


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
        if published.get(channel, {}).get("status") == "ok":
            print(f"{channel}: already published, skipping")
            continue

        config = channels.get(channel, {"type": "manual"})
        adapter_name = config.get("type", "manual")
        adapter = ADAPTERS.get(adapter_name)
        if adapter is None:
            raise SystemExit(
                f"channels.json: unknown adapter '{adapter_name}' for {channel}. "
                f"Options: {', '.join(ADAPTERS)}"
            )

        text = (item_dir / CHANNEL_FILES[channel]).read_text()
        meta = {"product": product, "slug": slug, "channel": channel}
        try:
            detail = adapter(text, meta, config)
            published[channel] = {
                "status": "ok",
                "adapter": adapter_name,
                "at": dt.datetime.now(dt.timezone.utc).isoformat(),
                "detail": detail,
            }
            print(f"{channel} ({adapter_name}): {detail}")
        except ChannelError as e:
            published[channel] = {"status": "error", "adapter": adapter_name, "detail": str(e)}
            print(f"{channel} ({adapter_name}): FAILED — {e}")

    (item_dir / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")

    if all(published.get(c, {}).get("status") == "ok" for c in CHANNEL_FILES):
        dest = QUEUE_DIR / "published" / slug
        item_dir.rename(dest)
        print(f"\nAll channels done -> queue/published/{slug}/")
    else:
        pending = [c for c in CHANNEL_FILES if published.get(c, {}).get("status") != "ok"]
        print(f"\nStill unpublished: {', '.join(pending)} (fix and re-run publish — done channels are skipped)")
