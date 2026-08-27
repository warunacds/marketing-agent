"""FastAPI backend for the dashboard (and any other client).

Run:  .venv/bin/uvicorn marketing_agent.api:app --port 8000

Auth: every /api/* endpoint (except /api/health) requires the X-API-Key header
to match the MARKETING_API_KEY env var (set it in .env). If the var is unset,
auth is DISABLED with a loud warning — acceptable on localhost only.

Mutations reuse the same functions as the CLI (approve/reject/publish), so the
terminal and the API share one code path. Pipeline runs are child processes
whose output streams to runs/jobs/<id>.log, same convention the dashboard's
old detached jobs used.
"""

import contextlib
import datetime as dt
import io
import json
import re
import subprocess
import sys
import threading

from fastapi import Depends, FastAPI, HTTPException, Request
from pydantic import BaseModel

from . import approve as approve_mod
from . import publish as publish_mod
from .config import BRANDS_DIR, QUEUE_DIR, RUNS_DIR, ROOT

import os

app = FastAPI(title="marketing-agent API")

SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9._-]*$", re.IGNORECASE)
BRAND_FILE_RE = re.compile(r"^[a-z0-9._-]+\.(md|json)$", re.IGNORECASE)
QUEUE_STATES = ("pending", "approved", "rejected", "published")
JOBS_DIR = RUNS_DIR / "jobs"

_jobs: dict[str, subprocess.Popen] = {}  # id -> live process (this server's runs)


def _check_slug(value: str, label: str = "slug") -> str:
    if not SLUG_RE.match(value):
        raise HTTPException(400, f"invalid {label}: {value}")
    return value


def require_api_key(request: Request) -> None:
    expected = os.environ.get("MARKETING_API_KEY")
    if not expected:
        return  # auth disabled (warned at startup)
    if request.headers.get("x-api-key") != expected:
        raise HTTPException(401, "invalid or missing X-API-Key")


@app.on_event("startup")
def warn_if_auth_disabled() -> None:
    if not os.environ.get("MARKETING_API_KEY"):
        print("WARNING: MARKETING_API_KEY is not set — API auth is DISABLED. "
              "Set it in .env before exposing this server.")


def _capture(fn, *args, **kwargs) -> str:
    """Run a CLI-style function (prints + SystemExit) and return its output."""
    buf = io.StringIO()
    try:
        with contextlib.redirect_stdout(buf):
            fn(*args, **kwargs)
    except SystemExit as e:  # CLI modules signal user errors this way
        raise HTTPException(400, str(e) or "command failed") from None
    return buf.getvalue().strip()


def _manifest(item_dir) -> dict:
    path = item_dir / "manifest.json"
    return json.loads(path.read_text()) if path.exists() else {}


def _revising_active(item_dir, manifest: dict) -> bool:
    """True while a revision is genuinely running. A crashed revise job would
    leave manifest.revising set forever (blocking approve), so if the flag is
    set but no revise job is alive in this server, clear it on disk."""
    if not manifest.get("revising"):
        return False
    if any("-revise-" in jid and p.poll() is None for jid, p in _jobs.items()):
        return True
    manifest["revising"] = False
    (item_dir / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    return False


# ---------------------------------------------------------------- health

@app.get("/api/health")
def health() -> dict:
    return {"ok": True}


# ---------------------------------------------------------------- queue

@app.get("/api/queue", dependencies=[Depends(require_api_key)])
def queue() -> dict:
    out: dict = {}
    for state in QUEUE_STATES:
        state_dir = QUEUE_DIR / state
        items = []
        if state_dir.is_dir():
            for item in sorted(state_dir.iterdir(), reverse=True):
                if item.is_dir():
                    items.append({"slug": item.name, **_manifest(item)})
        out[state] = items
    return out


@app.get("/api/items/{state}/{slug}", dependencies=[Depends(require_api_key)])
def item_detail(state: str, slug: str) -> dict:
    if state not in QUEUE_STATES:
        raise HTTPException(404, f"unknown state: {state}")
    _check_slug(slug)
    item_dir = QUEUE_DIR / state / slug
    if not item_dir.is_dir():
        raise HTTPException(404, f"no item {state}/{slug}")
    files = [
        {"name": f.name, "content": f.read_text()}
        for f in sorted(item_dir.glob("*.md"))
    ]
    return {"slug": slug, "state": state, "manifest": _manifest(item_dir), "files": files}


def _conflict(code: str, message: str) -> HTTPException:
    """409 with a machine-readable code: revising | factcheck_fail | factcheck_stale."""
    return HTTPException(409, {"code": code, "message": message})


class ApproveBody(BaseModel):
    force: bool = False  # approve even though the fact-check failed/stale
    approved_by: str | None = None  # display name of the person approving


@app.post("/api/items/{slug}/approve", dependencies=[Depends(require_api_key)])
def approve_item(slug: str, body: ApproveBody) -> dict:
    _check_slug(slug)
    item_dir = QUEUE_DIR / "pending" / slug
    manifest = _manifest(item_dir)
    if _revising_active(item_dir, manifest):
        raise _conflict("revising", "a revision is in progress for this item; wait for it to finish")
    if manifest.get("factcheck") == "FAIL" and not body.force:
        raise _conflict("factcheck_fail", "fact-check failed for this item; pass force=true to approve anyway")
    if manifest.get("factcheck") == "STALE" and not body.force:
        raise _conflict("factcheck_stale", "drafts were edited since the last fact-check; re-check facts "
                                           "or pass force=true to approve anyway")
    by = (body.approved_by or "").strip()[:80] or None
    return {"output": _capture(approve_mod.approve, slug, yes=True, by=by)}


EDITABLE_FILES = ("03-post.md", "04-social.md", "05-newsletter.md")


class FileBody(BaseModel):
    content: str


@app.put("/api/items/pending/{slug}/files/{name}", dependencies=[Depends(require_api_key)])
def edit_item_file(slug: str, name: str, body: FileBody) -> dict:
    _check_slug(slug)
    if name not in EDITABLE_FILES:
        raise HTTPException(400, f"only {', '.join(EDITABLE_FILES)} can be edited")
    item_dir = QUEUE_DIR / "pending" / slug
    if not item_dir.is_dir():
        raise HTTPException(404, f"no pending item {slug}")
    manifest = _manifest(item_dir)
    if _revising_active(item_dir, manifest):
        raise _conflict("revising", "a revision is in progress for this item; wait for it to finish")
    (item_dir / name).write_text(body.content.rstrip() + "\n")
    manifest["factcheck"] = "STALE"  # edits invalidate the last fact-check
    (item_dir / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    return {"output": f"saved {name}; fact-check is now stale"}


class ReviseBody(BaseModel):
    feedback: str
    model: str | None = None


@app.post("/api/items/{slug}/revise", dependencies=[Depends(require_api_key)])
def revise_item(slug: str, body: ReviseBody) -> dict:
    _check_slug(slug)
    if not body.feedback.strip():
        raise HTTPException(400, "feedback is required")
    if body.model:
        _check_slug(body.model, "model")
    item_dir = QUEUE_DIR / "pending" / slug
    manifest = _manifest(item_dir)
    if not manifest:
        raise HTTPException(404, f"no pending item {slug}")
    if _revising_active(item_dir, manifest):
        raise _conflict("revising", "a revision is already in progress for this item")

    manifest["revising"] = True
    (item_dir / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")

    args = ["revise", slug, "--feedback", body.feedback.strip()]
    if body.model:
        args += ["--model", body.model]
    return {"job_id": _spawn_job(args, "revise", manifest.get("product", slug))}


@app.post("/api/items/{slug}/factcheck", dependencies=[Depends(require_api_key)])
def factcheck_item(slug: str) -> dict:
    _check_slug(slug)
    item_dir = QUEUE_DIR / "pending" / slug
    manifest = _manifest(item_dir)
    if not manifest:
        raise HTTPException(404, f"no pending item {slug}")
    if _revising_active(item_dir, manifest):
        raise _conflict("revising", "a revision is in progress for this item; it re-checks facts itself")
    return {"job_id": _spawn_job(["factcheck", slug], "factcheck", manifest.get("product", slug))}


class RejectBody(BaseModel):
    reason: str = ""


@app.post("/api/items/{slug}/reject", dependencies=[Depends(require_api_key)])
def reject_item(slug: str, body: RejectBody) -> dict:
    _check_slug(slug)
    return {"output": _capture(approve_mod.reject, slug, body.reason or None)}


class PublishBody(BaseModel):
    channels: list[str] | None = None  # None = all


@app.post("/api/items/{slug}/publish", dependencies=[Depends(require_api_key)])
def publish_item(slug: str, body: PublishBody) -> dict:
    _check_slug(slug)
    if body.channels:
        for c in body.channels:
            _check_slug(c, "channel")
    return {"output": _capture(publish_mod.publish, slug, body.channels)}


# ---------------------------------------------------------------- brands

@app.get("/api/brands", dependencies=[Depends(require_api_key)])
def brands() -> list[dict]:
    return [
        {
            "product": p.name,
            "files": sorted(
                f.name for f in p.iterdir()
                if f.is_file() and BRAND_FILE_RE.match(f.name) and f.name != "schedule.json"
            ),
        }
        for p in sorted(BRANDS_DIR.iterdir())
        if p.is_dir() and not p.name.startswith("_")
    ]


@app.get("/api/brands/{product}", dependencies=[Depends(require_api_key)])
def brand_detail(product: str) -> dict:
    _check_slug(product, "product")
    path = BRANDS_DIR / product
    if not path.is_dir() or product.startswith("_"):
        raise HTTPException(404, f"no such product: {product}")
    files = [
        {"name": f.name, "content": f.read_text()}
        for f in sorted(path.iterdir())
        if f.is_file() and BRAND_FILE_RE.match(f.name) and f.name != "schedule.json"
    ]
    return {"product": product, "files": files}


class BrandFileBody(BaseModel):
    content: str


@app.put("/api/brands/{product}/{file}", dependencies=[Depends(require_api_key)])
def save_brand_file(product: str, file: str, body: BrandFileBody) -> dict:
    _check_slug(product, "product")
    if not BRAND_FILE_RE.match(file) or file == "schedule.json":
        raise HTTPException(400, f"invalid file name: {file}")
    path = BRANDS_DIR / product
    if not path.is_dir() or product.startswith("_"):
        raise HTTPException(404, f"no such product: {product}")
    if file == "channels.json":
        try:
            json.loads(body.content)
        except json.JSONDecodeError as e:
            raise HTTPException(400, f"channels.json is not valid JSON: {e}") from None
    (path / file).write_text(body.content)
    return {"output": f"saved brands/{product}/{file}"}


# ---------------------------------------------------------------- channels

CHANNEL_NAMES = ("blog", "social", "newsletter")
REQUIRED_CHANNEL_FIELDS = {
    "manual": (),
    "dir": ("path",),
    "webhook": ("url",),
    "typefully": ("api_key_env",),
    "browser_x": (),
    "browser_reddit": ("subreddit",),
    "browser_linkedin": (),
    "resend": ("api_key_env", "audience_id", "from"),
}


def _brand_dir_or_404(product: str):
    _check_slug(product, "product")
    path = BRANDS_DIR / product
    if not path.is_dir() or product.startswith("_"):
        raise HTTPException(404, f"no such product: {product}")
    return path


def _channels_path(product: str):
    return BRANDS_DIR / product / "channels.json"


def _load_channels_file(product: str) -> dict:
    path = _channels_path(product)
    return json.loads(path.read_text()) if path.exists() else {}


@app.get("/api/channels/{product}", dependencies=[Depends(require_api_key)])
def get_channels(product: str) -> dict:
    """Each channel is returned as a LIST of destinations (one or more)."""
    from .publish import as_destinations
    _brand_dir_or_404(product)
    raw = _load_channels_file(product)
    return {name: as_destinations(raw.get(name)) for name in CHANNEL_NAMES}


class ChannelsBody(BaseModel):
    channels: dict  # {name: config-object OR list-of-config-objects}


def _validate_destination(name: str, config) -> None:
    from .channels import ADAPTERS
    if not isinstance(config, dict):
        raise HTTPException(400, f"{name}: each destination must be an object")
    ctype = config.get("type", "manual")
    if ctype not in ADAPTERS:
        raise HTTPException(400, f"{name}: unknown type '{ctype}'. Options: {', '.join(ADAPTERS)}")
    for field in REQUIRED_CHANNEL_FIELDS[ctype]:
        if not str(config.get(field, "")).strip():
            raise HTTPException(400, f"{name}: '{ctype}' needs '{field}'")


@app.put("/api/channels/{product}", dependencies=[Depends(require_api_key)])
def save_channels(product: str, body: ChannelsBody) -> dict:
    _brand_dir_or_404(product)
    for name, value in body.channels.items():
        if name not in CHANNEL_NAMES:
            raise HTTPException(400, f"unknown channel: {name}")
        destinations = value if isinstance(value, list) else [value]
        if not destinations:
            raise HTTPException(400, f"{name}: at least one destination is required")
        for config in destinations:
            _validate_destination(name, config)
    # Preserve everything else in the file (gsc config, _examples).
    raw = _load_channels_file(product)
    raw.update(body.channels)
    _channels_path(product).write_text(json.dumps(raw, indent=2) + "\n")
    return {"output": f"channels saved for {product}"}


TEST_ASSETS = {
    "blog": "# Test post from Marketing assistant\n\nThis is a TEST publish to check the blog "
            "channel is wired up correctly. Safe to delete.\n",
    "social": "## X thread\n\n1. TEST: checking the social channel from Marketing assistant. "
              "Safe to delete this draft.\n2. If you can read this in your drafts, the "
              "connection works.\n\n## LinkedIn post\n\nTEST: checking the social channel. "
              "Safe to delete.\n\n## Reddit post\n\nTitle: TEST — Marketing assistant connection check\n\n"
              "This is a TEST post to check the Reddit channel is wired up. Safe to delete.\n",
    "newsletter": "## Subject lines\n\n- TEST: Marketing assistant connection check\n\n## Body\n\n"
                  "This is a TEST broadcast draft to check the newsletter channel. "
                  "It was not sent to anyone. Safe to delete.\n",
}


class ChannelTestBody(BaseModel):
    channel: str
    index: int = 0  # which destination in the channel's list to test


@app.post("/api/channels/{product}/test", dependencies=[Depends(require_api_key)])
def test_channel(product: str, body: ChannelTestBody) -> dict:
    from .channels import ADAPTERS, ChannelError
    from .publish import as_destinations
    _brand_dir_or_404(product)
    if body.channel not in CHANNEL_NAMES:
        raise HTTPException(400, f"unknown channel: {body.channel}")
    destinations = as_destinations(_load_channels_file(product).get(body.channel))
    if not 0 <= body.index < len(destinations):
        raise HTTPException(400, f"{body.channel} has no destination #{body.index}")
    config = destinations[body.index]
    adapter = ADAPTERS.get(config.get("type", "manual"))
    if adapter is None:
        raise HTTPException(400, f"unknown adapter type '{config.get('type')}'")
    meta = {
        "product": product,
        "slug": f"test-{dt.datetime.now(dt.timezone.utc).strftime('%Y%m%d%H%M%S')}",
        "channel": body.channel,
        "dry_run": True,  # a test never posts live (browser adapters compose only)
    }
    buf = io.StringIO()
    try:
        with contextlib.redirect_stdout(buf):
            detail = adapter(TEST_ASSETS[body.channel], meta, config)
    except ChannelError as e:
        raise HTTPException(400, str(e)) from None
    printed = buf.getvalue().strip()
    return {"output": detail + (f"\n\n{printed}" if printed else "")}


# ---------------------------------------------------------------- browser sessions

_login_flows: dict[str, dict] = {}  # platform -> {done, cancel, thread, status}


@app.get("/api/browser-sessions", dependencies=[Depends(require_api_key)])
def browser_sessions() -> list[dict]:
    """Which social platforms have a saved browser login, and whether a login
    browser is currently open (started from the dashboard)."""
    from .browser import PLATFORMS, has_session
    out = []
    for p, meta in PLATFORMS.items():
        flow = _login_flows.get(p)
        out.append({
            "platform": p, "label": meta["label"], "logged_in": has_session(p),
            "login_command": f"python -m marketing_agent login {p}",
            "login_in_progress": bool(flow and flow["thread"].is_alive()),
        })
    return out


def _known_platform(platform: str) -> str:
    from .browser import PLATFORMS
    if platform not in PLATFORMS:
        raise HTTPException(404, f"unknown platform: {platform}")
    return platform


@app.post("/api/browser-sessions/{platform}/login", dependencies=[Depends(require_api_key)])
def start_browser_login(platform: str) -> dict:
    """Open a headed browser on THIS machine for a one-time login. Only works when
    the backend runs where the operator can see the window (i.e. locally)."""
    import threading
    from .browser import PLATFORMS, open_login_browser
    _known_platform(platform)
    flow = _login_flows.get(platform)
    if flow and flow["thread"].is_alive():
        return {"status": "already_open",
                "message": f"A {PLATFORMS[platform]['label']} login window is already open."}
    done, cancel = threading.Event(), threading.Event()

    def _run() -> None:
        try:
            _login_flows[platform]["status"] = open_login_browser(platform, done, cancel)
        except Exception as e:  # e.g. no display on a headless server
            _login_flows[platform]["status"] = f"error: {e}"

    thread = threading.Thread(target=_run, daemon=True)
    _login_flows[platform] = {"done": done, "cancel": cancel, "thread": thread, "status": "open"}
    thread.start()
    return {"status": "opening",
            "message": f"A browser window is opening. Log into {PLATFORMS[platform]['label']}, "
                       f"then click ‘I’ve finished logging in’."}


@app.post("/api/browser-sessions/{platform}/login/confirm", dependencies=[Depends(require_api_key)])
def confirm_browser_login(platform: str) -> dict:
    from .browser import has_session
    _known_platform(platform)
    flow = _login_flows.get(platform)
    if not flow or not flow["thread"].is_alive():
        if has_session(platform):
            return {"status": "saved"}
        raise HTTPException(409, "no login window is open — start the login first")
    flow["done"].set()
    flow["thread"].join(timeout=20)
    return {"status": "saved" if has_session(platform) else flow.get("status", "unknown")}


@app.post("/api/browser-sessions/{platform}/login/cancel", dependencies=[Depends(require_api_key)])
def cancel_browser_login(platform: str) -> dict:
    _known_platform(platform)
    flow = _login_flows.get(platform)
    if flow and flow["thread"].is_alive():
        flow["cancel"].set()
        flow["thread"].join(timeout=20)
    return {"status": "cancelled"}


@app.delete("/api/browser-sessions/{platform}", dependencies=[Depends(require_api_key)])
def clear_browser_session(platform: str) -> dict:
    """Forget a saved login (log out on this machine)."""
    from .browser import PLATFORMS, clear_session
    _known_platform(platform)
    flow = _login_flows.get(platform)
    if flow and flow["thread"].is_alive():
        raise HTTPException(409, "a login window is open for this platform — finish or cancel it first")
    clear_session(platform)
    return {"status": "cleared", "message": f"logged out of {PLATFORMS[platform]['label']}"}


# ---------------------------------------------------------------- secrets

SECRET_NAME_RE = re.compile(r"^[A-Z][A-Z0-9_]{2,63}$")
PROTECTED_SECRETS = {"OPENAI_API_KEY", "MARKETING_API_KEY"}
ENV_FILE = ROOT / ".env"


@app.get("/api/secrets", dependencies=[Depends(require_api_key)])
def secrets(names: str = "") -> list[dict]:
    out = []
    for name in [n.strip() for n in names.split(",") if n.strip()]:
        if SECRET_NAME_RE.match(name):
            out.append({"name": name, "set": bool(os.environ.get(name))})
    return out


class SecretBody(BaseModel):
    name: str
    value: str


@app.put("/api/secrets", dependencies=[Depends(require_api_key)])
def save_secret(body: SecretBody) -> dict:
    name = body.name.strip()
    value = body.value.strip()
    if not SECRET_NAME_RE.match(name):
        raise HTTPException(400, "secret name must be UPPER_SNAKE_CASE")
    if name in PROTECTED_SECRETS:
        raise HTTPException(400, f"{name} cannot be changed from the dashboard")
    if not value or "\n" in value or "\r" in value:
        raise HTTPException(400, "value must be a non-empty single line")
    lines = ENV_FILE.read_text().splitlines() if ENV_FILE.exists() else []
    replaced = False
    for i, line in enumerate(lines):
        if line.startswith(f"{name}="):
            lines[i] = f"{name}={value}"
            replaced = True
            break
    if not replaced:
        lines.append(f"{name}={value}")
    ENV_FILE.write_text("\n".join(lines) + "\n")
    os.environ[name] = value  # visible to this server and future child jobs
    return {"output": f"{name} saved"}


@app.delete("/api/secrets/{name}", dependencies=[Depends(require_api_key)])
def delete_secret(name: str) -> dict:
    if not SECRET_NAME_RE.match(name):
        raise HTTPException(400, "secret name must be UPPER_SNAKE_CASE")
    if name in PROTECTED_SECRETS:
        raise HTTPException(400, f"{name} cannot be changed from the dashboard")
    if ENV_FILE.exists():
        lines = [l for l in ENV_FILE.read_text().splitlines() if not l.startswith(f"{name}=")]
        ENV_FILE.write_text("\n".join(lines) + "\n")
    os.environ.pop(name, None)
    return {"output": f"{name} removed"}


# ---------------------------------------------------------------- brand TODOs

TODO_SCAN_EXCLUDE = ("schedule.json", "channels.json")


@app.get("/api/brands/{product}/todos", dependencies=[Depends(require_api_key)])
def brand_todos(product: str) -> list[dict]:
    path = _brand_dir_or_404(product)
    out = []
    for f in sorted(path.glob("*.md")):
        for i, line in enumerate(f.read_text().splitlines(), 1):
            if "TODO" in line:
                out.append({"file": f.name, "line": i, "text": line.strip()})
    return out


class ResolveTodoBody(BaseModel):
    file: str
    todo: str  # the TODO line text being answered (as returned by the scan)
    answer: str


@app.post("/api/brands/{product}/todos/resolve", dependencies=[Depends(require_api_key)])
async def resolve_todo(product: str, body: ResolveTodoBody) -> dict:
    from .runner import log_step, run_agent
    path = _brand_dir_or_404(product)
    if not BRAND_FILE_RE.match(body.file) or not body.file.endswith(".md"):
        raise HTTPException(400, f"invalid file: {body.file}")
    if not body.answer.strip():
        raise HTTPException(400, "an answer is required")
    target = path / body.file
    if not target.exists():
        raise HTTPException(404, f"no file brands/{product}/{body.file}")
    content = target.read_text()
    if body.todo.strip() not in content:
        raise HTTPException(409, "that TODO is no longer in the file — reload and try again")

    result = await run_agent(
        "brand_editor",
        f"Product: {product}\nFile: brands/{product}/{body.file}\n\n"
        f"# Current file content\n\n{content}\n\n"
        f"# The TODO being answered\n\n{body.todo.strip()}\n\n"
        f"# The operator's answer\n\n{body.answer.strip()}",
    )
    target.write_text(result.text.strip() + "\n")
    run_dir = RUNS_DIR / dt.date.today().isoformat() / product
    run_dir.mkdir(parents=True, exist_ok=True)
    log_step(run_dir, result)
    remaining = sum(1 for line in result.text.splitlines() if "TODO" in line)
    return {"output": f"updated brands/{product}/{body.file}", "todos_remaining_in_file": remaining}


# ---------------------------------------------------------------- products

PRODUCT_NAME_RE = re.compile(r"^[a-z0-9][a-z0-9-]{1,40}$")


class ProductBody(BaseModel):
    name: str
    description: str | None = None


@app.post("/api/products", dependencies=[Depends(require_api_key)])
def create_product(body: ProductBody) -> dict:
    import shutil
    name = body.name.strip().lower()
    if not PRODUCT_NAME_RE.match(name):
        raise HTTPException(400, "name must be lowercase letters, digits, and hyphens (2-41 chars)")
    template = BRANDS_DIR / "_template"
    dest = BRANDS_DIR / name
    if dest.exists():
        raise HTTPException(409, f"product '{name}' already exists")
    if not template.is_dir():
        raise HTTPException(500, "brands/_template is missing")
    shutil.copytree(template, dest)
    out: dict = {"product": name, "output": f"created brands/{name}/ from the template"}
    if body.description and body.description.strip():
        out["job_id"] = _spawn_job(
            ["brandgen", name, "--description", body.description.strip()], "brandgen", name,
        )
    return out


class GenerateBody(BaseModel):
    target: str  # blog | x | linkedin | reddit | newsletter
    instructions: str | None = None


@app.post("/api/products/{product}/generate", dependencies=[Depends(require_api_key)])
def generate_channel(product: str, body: GenerateBody) -> dict:
    """Make one channel's content now, on demand. Always queues for review
    (auto-publish only happens on a schedule)."""
    from .pipelines.channel_content import TARGETS
    _brand_dir_or_404(product)
    if body.target not in TARGETS:
        raise HTTPException(400, f"unknown target '{body.target}'. Options: {', '.join(TARGETS)}")
    args = ["channel-content", "--product", product, "--target", body.target]
    if body.instructions and body.instructions.strip():
        args += ["--instructions", body.instructions.strip()]
    return {"job_id": _spawn_job(args, f"channel-{body.target}", product)}


# ---------------------------------------------------------------- runs / jobs

class PipelineBody(BaseModel):
    pipeline: str  # "content" | "report"
    product: str
    model: str | None = None
    instructions: str | None = None  # free-text guidance for this run


def _spawn_job(cli_args: list[str], kind: str, product: str) -> str:
    """Start `python -m marketing_agent <cli_args>` as a logged background job."""
    JOBS_DIR.mkdir(parents=True, exist_ok=True)
    job_id = (
        dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H-%M-%S-%fZ")
        + f"-{kind}-{product}"
    )
    log_file = JOBS_DIR / f"{job_id}.log"

    with open(log_file, "a") as out:
        proc = subprocess.Popen(
            [sys.executable, "-m", "marketing_agent", *cli_args],
            cwd=ROOT, stdout=out, stderr=out,
        )
    _jobs[job_id] = proc

    def _mark_exit() -> None:
        code = proc.wait()
        with open(log_file, "a") as f:
            f.write(f"\n=== JOB EXIT {code} ===\n")

    threading.Thread(target=_mark_exit, daemon=True).start()
    return job_id


@app.post("/api/pipelines", dependencies=[Depends(require_api_key)])
def start_pipeline(body: PipelineBody) -> dict:
    if body.pipeline not in ("content", "report"):
        raise HTTPException(400, "pipeline must be 'content' or 'report'")
    _check_slug(body.product, "product")
    if body.model:
        _check_slug(body.model, "model")

    args = [body.pipeline, "--product", body.product]
    if body.model:
        args += ["--model", body.model]
    if body.pipeline == "content" and body.instructions and body.instructions.strip():
        args += ["--instructions", body.instructions.strip()]
    return {"job_id": _spawn_job(args, body.pipeline, body.product)}


def _job_status(job_id: str, log_text: str) -> str:
    proc = _jobs.get(job_id)
    if proc is not None and proc.poll() is None:
        return "running"
    m = re.search(r"=== JOB EXIT (-?\d+) ===", log_text)
    if m:
        return "done" if m.group(1) == "0" else "failed"
    return "interrupted"  # no exit marker and not one of ours: server restarted mid-run


@app.get("/api/jobs", dependencies=[Depends(require_api_key)])
def jobs() -> list[dict]:
    if not JOBS_DIR.is_dir():
        return []
    out = []
    for log in sorted(JOBS_DIR.glob("*.log"), reverse=True):
        text = log.read_text()
        out.append({"id": log.stem, "status": _job_status(log.stem, text)})
    return out


@app.get("/api/jobs/{job_id}", dependencies=[Depends(require_api_key)])
def job_detail(job_id: str) -> dict:
    _check_slug(job_id, "job id")
    log = JOBS_DIR / f"{job_id}.log"
    if not log.exists():
        raise HTTPException(404, f"no job {job_id}")
    text = log.read_text()
    return {"id": job_id, "status": _job_status(job_id, text), "log": text}


def _read_costs(run_dir) -> tuple[list[dict], float]:
    path = run_dir / "costs.jsonl"
    if not path.exists():
        return [], 0.0
    steps = [json.loads(line) for line in path.read_text().splitlines() if line.strip()]
    total = round(sum(s.get("cost_usd") or 0 for s in steps), 4)
    return steps, total


@app.get("/api/runs", dependencies=[Depends(require_api_key)])
def runs() -> list[dict]:
    out = []
    if RUNS_DIR.is_dir():
        for date_dir in sorted(RUNS_DIR.iterdir(), reverse=True):
            if not date_dir.is_dir() or date_dir.name == "jobs":
                continue
            for product_dir in sorted(date_dir.iterdir()):
                if product_dir.is_dir():
                    _, total = _read_costs(product_dir)
                    out.append({
                        "date": date_dir.name,
                        "product": product_dir.name,
                        "files": sorted(f.name for f in product_dir.glob("*.md")),
                        "total_cost_usd": total,
                    })
    return out


# ---------------------------------------------------------------- schedule

WEEKDAYS = ("monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday")


def _schedule_path(product: str):
    return BRANDS_DIR / product / "schedule.json"


SCHEDULE_TARGETS = ("blog", "x", "linkedin", "reddit", "newsletter")
CADENCES = ("daily", "every_n_days", "weekly")
REPORT_DEFAULTS = {"report_enabled": False, "report_day": "friday", "report_hour": 17}


def _read_schedule(product: str) -> dict:
    """Normalize stored schedule to the entries model. Migrates the old flat
    {enabled,day,hour,instructions} content schedule to a single weekly blog entry."""
    path = _schedule_path(product)
    stored = json.loads(path.read_text()) if path.exists() else {}
    entries = stored.get("entries")
    if entries is None:
        entries = []
        if stored.get("enabled"):  # legacy flat content schedule
            entries.append({
                "target": "blog", "enabled": True, "cadence": "weekly",
                "day": stored.get("day", "monday"), "hour": stored.get("hour", 9),
                "auto_publish": False, "instructions": stored.get("instructions", ""),
                "last_run": stored.get("last_run"),
            })
    return {
        "entries": entries,
        **REPORT_DEFAULTS,
        **{k: stored[k] for k in ("report_enabled", "report_day", "report_hour", "report_last_run") if k in stored},
    }


class ScheduleEntry(BaseModel):
    target: str
    enabled: bool = True
    cadence: str = "weekly"          # daily | every_n_days | weekly
    every_n_days: int = 3            # used when cadence == every_n_days
    day: str = "monday"             # used when cadence == weekly
    hour: int = 9                    # 0-23, server-local
    auto_publish: bool = False       # skip manual approval (only on fact-check PASS)
    instructions: str = ""
    last_run: str | None = None


class ScheduleBody(BaseModel):
    entries: list[ScheduleEntry] = []
    report_enabled: bool = False
    report_day: str = "friday"
    report_hour: int = 17


@app.get("/api/schedule", dependencies=[Depends(require_api_key)])
def schedules() -> list[dict]:
    return [
        {"product": p.name, **_read_schedule(p.name)}
        for p in sorted(BRANDS_DIR.iterdir())
        if p.is_dir() and not p.name.startswith("_")
    ]


@app.put("/api/schedule/{product}", dependencies=[Depends(require_api_key)])
def save_schedule(product: str, body: ScheduleBody) -> dict:
    _check_slug(product, "product")
    if not (BRANDS_DIR / product).is_dir() or product.startswith("_"):
        raise HTTPException(404, f"no such product: {product}")
    if body.report_day.lower() not in WEEKDAYS:
        raise HTTPException(400, f"report day must be one of: {', '.join(WEEKDAYS)}")
    if not 0 <= body.report_hour <= 23:
        raise HTTPException(400, "report hour must be 0-23")
    seen = set()
    prior = {e.get("target"): e for e in _read_schedule(product)["entries"]}
    entries_out = []
    for e in body.entries:
        if e.target not in SCHEDULE_TARGETS:
            raise HTTPException(400, f"unknown target '{e.target}'. Options: {', '.join(SCHEDULE_TARGETS)}")
        if e.target in seen:
            raise HTTPException(400, f"duplicate schedule for '{e.target}'")
        seen.add(e.target)
        if e.cadence not in CADENCES:
            raise HTTPException(400, f"cadence must be one of: {', '.join(CADENCES)}")
        if e.cadence == "weekly" and e.day.lower() not in WEEKDAYS:
            raise HTTPException(400, f"day must be one of: {', '.join(WEEKDAYS)}")
        if e.cadence == "every_n_days" and not 1 <= e.every_n_days <= 60:
            raise HTTPException(400, "every_n_days must be 1-60")
        if not 0 <= e.hour <= 23:
            raise HTTPException(400, "hour must be 0-23")
        entry = e.model_dump()
        entry["day"] = entry["day"].lower()
        entry["instructions"] = entry["instructions"].strip()
        # preserve last_run across edits unless the client sent one
        if entry.get("last_run") is None and e.target in prior:
            entry["last_run"] = prior[e.target].get("last_run")
        entries_out.append(entry)

    out = {
        "entries": entries_out,
        "report_enabled": body.report_enabled,
        "report_day": body.report_day.lower(),
        "report_hour": body.report_hour,
        "report_last_run": _read_schedule(product).get("report_last_run"),
    }
    _schedule_path(product).write_text(json.dumps(out, indent=2) + "\n")
    return {"output": f"schedule saved for {product}"}


def _entry_due(entry: dict, now: "dt.datetime") -> bool:
    if not entry.get("enabled") or now.hour != int(entry.get("hour", -1)):
        return False
    last = entry.get("last_run")
    if last == now.date().isoformat():
        return False  # already ran today
    cadence = entry.get("cadence", "weekly")
    if cadence == "daily":
        return True
    if cadence == "weekly":
        return WEEKDAYS[now.weekday()] == entry.get("day")
    if cadence == "every_n_days":
        if not last:
            return True
        try:
            gap = (now.date() - dt.date.fromisoformat(last)).days
        except ValueError:
            return True
        return gap >= int(entry.get("every_n_days", 1))
    return False


def _scheduler_tick(now: "dt.datetime | None" = None) -> list[str]:
    """Start per-channel content runs (and reports) that are due."""
    now = now or dt.datetime.now()
    started = []
    if not BRANDS_DIR.is_dir():
        return started
    for p in BRANDS_DIR.iterdir():
        if not p.is_dir() or p.name.startswith("_"):
            continue
        sched = _read_schedule(p.name)
        dirty = False
        for entry in sched["entries"]:
            if not _entry_due(entry, now):
                continue
            entry["last_run"] = now.date().isoformat()  # mark before spawning
            dirty = True
            args = ["channel-content", "--product", p.name, "--target", entry["target"]]
            if entry.get("instructions"):
                args += ["--instructions", entry["instructions"]]
            if entry.get("auto_publish"):
                args += ["--auto-publish"]
            started.append(_spawn_job(args, f"scheduled-{entry['target']}", p.name))
        # weekly report (unchanged cadence)
        if sched.get("report_enabled") and now.hour == int(sched.get("report_hour", -1)) \
                and WEEKDAYS[now.weekday()] == sched.get("report_day") \
                and sched.get("report_last_run") != now.date().isoformat():
            sched["report_last_run"] = now.date().isoformat()
            dirty = True
            started.append(_spawn_job(["report", "--product", p.name], "report", p.name))
        if dirty:
            _schedule_path(p.name).write_text(json.dumps(sched, indent=2) + "\n")
    return started


async def _scheduler_loop() -> None:
    import asyncio
    while True:
        try:
            for job_id in _scheduler_tick():
                print(f"scheduler: started {job_id}")
        except Exception as e:  # a bad schedule file must not kill the loop
            print(f"scheduler error (non-fatal): {e}")
        await asyncio.sleep(60)


@app.on_event("startup")
async def start_scheduler() -> None:
    import asyncio
    asyncio.create_task(_scheduler_loop())


@app.get("/api/runs/{date}/{product}/costs", dependencies=[Depends(require_api_key)])
def run_costs(date: str, product: str) -> dict:
    _check_slug(date, "date")
    _check_slug(product, "product")
    run_dir = RUNS_DIR / date / product
    if not run_dir.is_dir():
        raise HTTPException(404, f"no run {date}/{product}")
    steps, total = _read_costs(run_dir)
    return {"date": date, "product": product, "steps": steps, "total_cost_usd": total}


@app.get("/api/runs/{date}/{product}/{file}", dependencies=[Depends(require_api_key)])
def run_file(date: str, product: str, file: str) -> dict:
    _check_slug(date, "date")
    _check_slug(product, "product")
    if not BRAND_FILE_RE.match(file):
        raise HTTPException(400, f"invalid file name: {file}")
    path = RUNS_DIR / date / product / file
    if not path.exists():
        raise HTTPException(404, f"no file runs/{date}/{product}/{file}")
    return {"content": path.read_text()}
