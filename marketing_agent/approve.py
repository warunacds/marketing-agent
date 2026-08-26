"""Human approval gate over queue/. Nothing publishes without a record here."""

import datetime as dt
import getpass
import json
from pathlib import Path

from .config import QUEUE_DIR


def _manifest(item_dir: Path) -> dict:
    path = item_dir / "manifest.json"
    return json.loads(path.read_text()) if path.exists() else {}


def list_queue() -> None:
    pending = sorted(p for p in (QUEUE_DIR / "pending").iterdir() if p.is_dir())
    if not pending:
        print("Queue is empty.")
        return
    print(f"{'ITEM':<34} {'FACT-CHECK':<11} FILES")
    for item in pending:
        m = _manifest(item)
        print(f"{item.name:<34} {m.get('factcheck', '?'):<11} {', '.join(m.get('files', []))}")
    print("\nReview drafts in queue/pending/<item>/, then approve or reject by name.")


def _move(slug: str, dest_name: str, extra: dict) -> None:
    src = QUEUE_DIR / "pending" / slug
    if not src.is_dir():
        raise SystemExit(f"No pending item '{slug}'. See: python -m marketing_agent queue")
    manifest = _manifest(src)
    manifest.update(extra)
    (src / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    dest = QUEUE_DIR / dest_name / slug
    src.rename(dest)
    print(f"{slug} -> queue/{dest_name}/")


def approve(slug: str, yes: bool = False) -> None:
    m = _manifest(QUEUE_DIR / "pending" / slug) if (QUEUE_DIR / "pending" / slug).is_dir() else {}
    if m.get("factcheck") == "FAIL" and not yes:
        confirm = input("Fact-check FAILED for this item. Approve anyway? [y/N] ")
        if confirm.strip().lower() != "y":
            print("Not approved.")
            return
    _move(slug, "approved", {
        "approved": True,
        "approved_by": getpass.getuser(),
        "approved_at": dt.datetime.now(dt.timezone.utc).isoformat(),
    })
    print(f"Approved. Publish with: python -m marketing_agent publish {slug}")


def reject(slug: str, reason: str | None = None) -> None:
    _move(slug, "rejected", {
        "approved": False,
        "rejected_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        "reason": reason or "",
    })
