import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BRANDS_DIR = ROOT / "brands"
AGENTS_DIR = ROOT / "agents"
RUNS_DIR = ROOT / "runs"
QUEUE_DIR = ROOT / "queue"


def _load_dotenv() -> None:
    """Tiny .env loader so the repo needs no extra dependency."""
    env_file = ROOT / ".env"
    if not env_file.exists():
        return
    for line in env_file.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip())


_load_dotenv()

# Main pipeline model; override with MARKETING_MODEL.
DEFAULT_MODEL = os.environ.get("MARKETING_MODEL", "claude-opus-5")
# The fact-check gate is a cheap comparison task — a small model is plenty.
FACTCHECK_MODEL = os.environ.get("MARKETING_FACTCHECK_MODEL", "claude-haiku-4-5")


def brand_dir(product: str) -> Path:
    """Return the brand-brain folder for a product, or raise with a helpful error."""
    path = BRANDS_DIR / product
    if not path.is_dir() or product.startswith("_"):
        available = sorted(
            p.name for p in BRANDS_DIR.iterdir()
            if p.is_dir() and not p.name.startswith("_")
        )
        raise SystemExit(
            f"No brand brain at brands/{product}/.\n"
            f"Available products: {', '.join(available) or '(none yet)'}\n"
            f"Create one with: cp -r brands/_template brands/{product}"
        )
    return path
