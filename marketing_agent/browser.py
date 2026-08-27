"""Browser automation poster: post to social platforms through a real browser,
reusing a session you logged into by hand — no stored passwords.

The model:
1. `save_login(platform)` opens a headed browser to a per-platform profile dir.
   You log in yourself (2FA, CAPTCHA and all) and press Enter. The profile keeps
   the cookies.
2. `post_to_x(...)` relaunches that same profile — already authenticated — and
   drives the composer like a person: types, paces, clicks Post.
3. When the session eventually expires, posting raises SessionExpired and you
   run the login again.

Profiles live in sessions/<platform>-profile/ (git-ignored). Selectors that
platforms may change are kept in constants near the top so they're easy to fix.
"""

import time
from pathlib import Path

from .config import ROOT

SESSIONS_DIR = ROOT / "sessions"

# X (twitter) — data-testid attributes are the most stable handles on the site.
X_COMPOSE_URL = "https://x.com/compose/post"
X_TEXTAREA = '[data-testid="tweetTextarea_0"]'
X_ADD_BUTTON = '[data-testid="addButton"]'
X_POST_BUTTON = '[data-testid="tweetButton"]'
X_LOGGED_OUT_MARKERS = ("/login", "/i/flow/login", "/i/flow/signup")

# Reddit — new-reddit uses web components, but Playwright locators pierce open
# shadow DOM, so role-based handles are the most durable. Submitting a text post
# goes through r/<sub>/submit?type=TEXT, which prefills the target community.
REDDIT_SUBMIT_URL = "https://www.reddit.com/r/{subreddit}/submit?type=TEXT"
REDDIT_LOGGED_OUT_MARKERS = ("/login", "/register")

# LinkedIn — a single self-post via the feed composer (Quill editor).
LINKEDIN_FEED_URL = "https://www.linkedin.com/feed/"
LINKEDIN_LOGGED_OUT_MARKERS = ("/login", "/uas/login", "/checkpoint", "/authwall")
LINKEDIN_START_POST = "button.share-box-feed-entry__trigger"
LINKEDIN_EDITOR = '.ql-editor[contenteditable="true"]'
LINKEDIN_POST_BUTTON = "button.share-actions__primary-action"

PLATFORMS = {
    "x": {"login_url": "https://x.com/login", "home_url": "https://x.com/home", "label": "X"},
    "reddit": {"login_url": "https://www.reddit.com/login",
               "home_url": "https://www.reddit.com/", "label": "Reddit"},
    "linkedin": {"login_url": "https://www.linkedin.com/login",
                 "home_url": "https://www.linkedin.com/feed/", "label": "LinkedIn"},
}


class BrowserPosterError(Exception):
    pass


class SessionExpired(BrowserPosterError):
    pass


def _profile_dir(platform: str) -> Path:
    return SESSIONS_DIR / f"{platform}-profile"


def _confirmed_marker(platform: str) -> Path:
    return _profile_dir(platform) / ".login-confirmed"


def _mark_confirmed(platform: str) -> None:
    """Record that a login was actually completed (not just that a browser opened)."""
    _profile_dir(platform).mkdir(parents=True, exist_ok=True)
    _confirmed_marker(platform).touch()


def has_session(platform: str) -> bool:
    """True only after a login was completed. Merely opening the login browser
    creates the profile dir, so we require an explicit confirmation marker.
    Real cookie validity is still only known at post time."""
    return _confirmed_marker(platform).exists()


def clear_session(platform: str) -> None:
    """Forget a saved login by removing its whole profile."""
    import shutil
    d = _profile_dir(platform)
    if d.exists():
        shutil.rmtree(d)


def save_login(platform: str) -> None:
    """Open a headed browser so the operator can log in by hand; keep the profile."""
    if platform not in PLATFORMS:
        raise BrowserPosterError(f"unknown platform '{platform}'. Known: {', '.join(PLATFORMS)}")
    from playwright.sync_api import sync_playwright

    profile = _profile_dir(platform)
    profile.mkdir(parents=True, exist_ok=True)
    meta = PLATFORMS[platform]

    print(f"\nOpening a browser for {meta['label']}. Log in as you normally would.")
    print("When you can see your logged-in home feed, come back here and press Enter.\n")
    with sync_playwright() as pw:
        ctx = pw.chromium.launch_persistent_context(
            str(profile), headless=False, viewport={"width": 1280, "height": 900},
        )
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        page.goto(meta["login_url"])
        try:
            input("Press Enter once you're logged in (or Ctrl-C to cancel)… ")
            _mark_confirmed(platform)  # only after the operator confirms
        finally:
            ctx.close()
    print(f"Saved {meta['label']} session to {profile}")


def open_login_browser(platform: str, done_event, cancel_event, timeout: float = 600) -> str:
    """Headed login driven from the dashboard: open the login page and hold the
    browser until the operator signals done (a UI button sets done_event), cancels,
    or the timeout lapses. The persistent profile saves cookies as they log in, so
    closing is enough. Returns 'saved' | 'cancelled' | 'timeout'."""
    if platform not in PLATFORMS:
        raise BrowserPosterError(f"unknown platform '{platform}'. Known: {', '.join(PLATFORMS)}")
    from playwright.sync_api import sync_playwright

    profile = _profile_dir(platform)
    profile.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as pw:
        ctx = pw.chromium.launch_persistent_context(
            str(profile), headless=False, viewport={"width": 1280, "height": 900},
        )
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        page.goto(PLATFORMS[platform]["login_url"])
        waited = 0.0
        while waited < timeout and not done_event.is_set() and not cancel_event.is_set():
            time.sleep(0.5)
            waited += 0.5
        if done_event.is_set():
            _mark_confirmed(platform)  # only a confirmed login counts as a session
        try:
            ctx.close()
        except Exception:
            pass
    if done_event.is_set():
        return "saved"
    return "cancelled" if cancel_event.is_set() else "timeout"


def _human_pause(seconds: float = 0.6) -> None:
    time.sleep(seconds)


def post_to_x(tweets: list[str], *, dry_run: bool = False, headed: bool = True,
              screenshot: Path | None = None) -> str:
    """Post a thread to X using the saved profile. dry_run fills but never posts."""
    if not tweets:
        raise BrowserPosterError("no tweets to post")
    if not has_session("x"):
        raise SessionExpired("no X session — run: python -m marketing_agent login x")
    from playwright.sync_api import TimeoutError as PWTimeout, sync_playwright

    with sync_playwright() as pw:
        ctx = pw.chromium.launch_persistent_context(
            str(_profile_dir("x")), headless=not headed,
            viewport={"width": 1280, "height": 900},
        )
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        try:
            page.goto(X_COMPOSE_URL, wait_until="domcontentloaded")
            _human_pause()
            if any(m in page.url for m in X_LOGGED_OUT_MARKERS):
                raise SessionExpired("X session expired — run: python -m marketing_agent login x")
            try:
                page.wait_for_selector(X_TEXTAREA, timeout=15000)
            except PWTimeout:
                raise SessionExpired(
                    "couldn't reach the X composer (session expired or the page changed) — "
                    "run: python -m marketing_agent login x"
                ) from None

            for i, tweet in enumerate(tweets):
                box = page.locator(f'[data-testid="tweetTextarea_{i}"]')
                box.click()
                _human_pause(0.3)
                page.keyboard.type(tweet, delay=18)  # per-char delay: reads as typing
                _human_pause(0.5)
                if i < len(tweets) - 1:
                    page.locator(X_ADD_BUTTON).first.click()
                    _human_pause(0.5)

            if screenshot:
                screenshot.parent.mkdir(parents=True, exist_ok=True)
                page.screenshot(path=str(screenshot))

            if dry_run:
                _human_pause(1.0)
                return (f"DRY RUN — composed {len(tweets)} tweet(s) in the X composer but did "
                        f"NOT post. Nothing was published.")

            page.locator(X_POST_BUTTON).first.click()
            _human_pause(2.5)  # let the post settle before we tear the browser down
            return f"posted a {len(tweets)}-tweet thread to X"
        finally:
            ctx.close()


def post_to_reddit(subreddit: str, title: str, body: str, *, dry_run: bool = False,
                   headed: bool = True, screenshot: Path | None = None) -> str:
    """Submit a text post to r/<subreddit> using the saved profile. dry_run fills
    the form but never submits."""
    import re as _re
    subreddit = subreddit.strip().lstrip("/").removeprefix("r/").strip("/")
    if not _re.fullmatch(r"[A-Za-z0-9_]{2,21}", subreddit):
        raise BrowserPosterError(f"invalid subreddit name: {subreddit!r}")
    if not title.strip():
        raise BrowserPosterError("a Reddit post needs a title")
    if not has_session("reddit"):
        raise SessionExpired("no Reddit session — run: python -m marketing_agent login reddit")
    from playwright.sync_api import TimeoutError as PWTimeout, sync_playwright

    with sync_playwright() as pw:
        ctx = pw.chromium.launch_persistent_context(
            str(_profile_dir("reddit")), headless=not headed,
            viewport={"width": 1280, "height": 900},
        )
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        try:
            page.goto(REDDIT_SUBMIT_URL.format(subreddit=subreddit), wait_until="domcontentloaded")
            _human_pause(1.0)
            if any(m in page.url for m in REDDIT_LOGGED_OUT_MARKERS):
                raise SessionExpired("Reddit session expired — run: python -m marketing_agent login reddit")

            # Title: prefer the accessible name, fall back to the textarea by name.
            title_box = page.get_by_role("textbox", name=_re.compile("title", _re.I))
            try:
                title_box.wait_for(timeout=15000)
            except PWTimeout:
                title_box = page.locator('textarea[name="title"], textarea[placeholder*="Title" i]')
                try:
                    title_box.first.wait_for(timeout=8000)
                except PWTimeout:
                    raise SessionExpired(
                        "couldn't reach the Reddit composer (session expired or the page changed) — "
                        "run: python -m marketing_agent login reddit"
                    ) from None
            title_box.first.click()
            _human_pause(0.3)
            page.keyboard.type(title.strip(), delay=16)
            _human_pause(0.5)

            # Body: the rich-text editor is a contenteditable textbox; the title
            # is the first textbox, the body the next one.
            body_box = page.get_by_role("textbox").nth(1)
            body_box.click()
            _human_pause(0.3)
            page.keyboard.type(body.strip(), delay=10)
            _human_pause(0.6)

            if screenshot:
                screenshot.parent.mkdir(parents=True, exist_ok=True)
                page.screenshot(path=str(screenshot))

            if dry_run:
                _human_pause(1.0)
                return (f"DRY RUN — filled a post for r/{subreddit} but did NOT submit. "
                        f"Nothing was published.")

            submit = page.get_by_role("button", name=_re.compile(r"^post$", _re.I))
            submit.first.click()
            _human_pause(3.0)
            return f"submitted a text post to r/{subreddit}"
        finally:
            ctx.close()


def post_to_linkedin(text: str, *, dry_run: bool = False, headed: bool = True,
                     screenshot: Path | None = None) -> str:
    """Publish a single self-post to LinkedIn using the saved profile."""
    import re as _re
    text = text.strip()
    if not text:
        raise BrowserPosterError("empty LinkedIn post")
    if not has_session("linkedin"):
        raise SessionExpired("no LinkedIn session — run: python -m marketing_agent login linkedin")
    from playwright.sync_api import TimeoutError as PWTimeout, sync_playwright

    with sync_playwright() as pw:
        ctx = pw.chromium.launch_persistent_context(
            str(_profile_dir("linkedin")), headless=not headed,
            viewport={"width": 1280, "height": 900},
        )
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        try:
            page.goto(LINKEDIN_FEED_URL, wait_until="domcontentloaded")
            _human_pause(1.2)
            if any(m in page.url for m in LINKEDIN_LOGGED_OUT_MARKERS):
                raise SessionExpired("LinkedIn session expired — run: python -m marketing_agent login linkedin")

            trigger = page.get_by_role("button", name=_re.compile("start a post", _re.I))
            try:
                trigger.first.wait_for(timeout=15000)
            except PWTimeout:
                trigger = page.locator(LINKEDIN_START_POST)
                try:
                    trigger.first.wait_for(timeout=8000)
                except PWTimeout:
                    raise SessionExpired(
                        "couldn't reach the LinkedIn composer (session expired or the page changed) — "
                        "run: python -m marketing_agent login linkedin"
                    ) from None
            trigger.first.click()
            _human_pause(1.0)

            editor = page.locator(LINKEDIN_EDITOR)
            editor.first.wait_for(timeout=10000)
            editor.first.click()
            _human_pause(0.3)
            page.keyboard.type(text, delay=8)
            _human_pause(0.6)

            if screenshot:
                screenshot.parent.mkdir(parents=True, exist_ok=True)
                page.screenshot(path=str(screenshot))

            if dry_run:
                _human_pause(1.0)
                return "DRY RUN — composed a LinkedIn post but did NOT publish. Nothing was posted."

            post_btn = page.get_by_role("button", name=_re.compile(r"^post$", _re.I))
            try:
                post_btn.first.wait_for(timeout=5000)
                post_btn.first.click()
            except PWTimeout:
                page.locator(LINKEDIN_POST_BUTTON).first.click()
            _human_pause(3.0)
            return "posted to LinkedIn"
        finally:
            ctx.close()
