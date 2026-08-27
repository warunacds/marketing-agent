# Per-channel scheduling

Today: one weekly run per product drafts a blog + social + newsletter bundle, held
for manual approval. Wanted: each channel on its own cadence (blog weekly, LinkedIn
every few days, X daily), gated by approval by default, with a per-channel
auto-publish override.

## Model

`schedule.json` becomes:
```json
{
  "entries": [
    {"target":"blog",     "enabled":true,  "cadence":"weekly",       "day":"monday", "hour":9,  "auto_publish":false, "instructions":"", "last_run":null},
    {"target":"linkedin", "enabled":true,  "cadence":"every_n_days", "every_n_days":3, "hour":10, "auto_publish":false, "instructions":"", "last_run":null},
    {"target":"x",        "enabled":true,  "cadence":"daily",        "hour":8,  "auto_publish":true,  "instructions":"", "last_run":null}
  ],
  "report_enabled": false, "report_day": "friday", "report_hour": 17, "report_last_run": null
}
```
- **target** ∈ `blog | x | linkedin | reddit | newsletter`. One entry per target max.
- **cadence**: `daily` | `every_n_days` (uses `every_n_days`) | `weekly` (uses `day`).
- **hour**: 0–23 server-local.
- **auto_publish**: false (default) → generated item waits in Review. true → on fact-check PASS the
  item is auto-approved and published to that target's destinations; on FAIL it still waits (safety).
- **instructions**: optional standing guidance for that channel's runs.
- Backward-compat: an old flat `{enabled,day,hour,instructions}` content schedule is read as a single
  `blog` weekly entry. Report keys unchanged.

Due check (in the 60s tick), per entry, skip if already ran today (`last_run == today`):
- daily → `now.hour == hour`
- every_n_days → `now.hour == hour and (last_run is None or (today-last_run).days >= n)`
- weekly → `WEEKDAYS[now.weekday()] == day and now.hour == hour`

## Per-channel generation (`pipelines/channel_content.py`)

`generate(product, target, *, instructions, auto_publish, model)` produces ONE channel's content as
its own queue item, fact-checks it, and (if auto_publish and PASS) approves+publishes it.

- **blog** → research → seo → writer (existing agents) → `03-post.md`; fact-check the blog.
- **x / linkedin / reddit** → a new `standalone_social` agent writes ONE platform section in the exact
  format publish expects (`## X thread` / `## LinkedIn post` / `## Reddit post`) → `04-social.md`.
  Grounded in the brand brain + learnings + the most recent published blog (if any) + the entry's
  instructions + the last few same-platform posts ("recently posted, don't repeat"). Fact-check it.
- **newsletter** → existing email agent from the latest blog (or brand brain if none) → `05-newsletter.md`.

Item: slug `<date>-<product>-<target>`; manifest carries `target`, `channels` (which of blog/social/
newsletter it uses), and for social a `platform`. Cost logged to the run dir. One item per target per day.

## Targeted publish (`publish.py`)

Publishing an item with a `target` only touches that target's channel — and for a social platform,
only destinations of the matching type (`x`→browser_x/typefully, `linkedin`→browser_linkedin,
`reddit`→browser_reddit). Untargeted (bundle) items publish all channels as today. The "all done →
move to published" check considers only the item's own channels/destinations.

## Auto-publish path

At the end of `generate`, if `auto_publish` and factcheck PASS: approve (records `approved_by:
"schedule"`) then publish the target. If FAIL (or auto_publish false): leave pending. Fact-check
never bypassed — a failed check always holds for a human. A destination left in `dry_run` composes
without posting even when auto-published (the dry-run flag still wins).

## API + CLI

- `PUT /api/schedule/{product}` accepts the `entries` list (validated: known targets, cadence fields,
  hour range) + report keys. `GET` returns it. `_read_schedule` normalizes/migrates.
- `POST /api/products/{product}/generate` {target, instructions?} → a manual "make this channel now"
  job (no auto-publish; always queues for review).
- CLI `python -m marketing_agent channel-content --product X --target x [--instructions ..] [--auto-publish]`.

## Dashboard

Publishing → Schedule becomes a per-channel list: one row per channel with an enable toggle, a cadence
picker (Every day / Every N days / Weekly on <day>), a time, and an "Auto-publish (skip my approval)"
switch defaulting OFF with a plain caution ("Posts on its own once it passes the fact-check. Leave off
to approve each one."). Report schedule stays. Home "Coming up" summarizes the per-channel cadences.

## Build order
1. Backend: schedule model v2 + due logic; `standalone_social` agent + `channel_content.py`; targeted
   publish; auto-publish; API + CLI. Test with cheap model + manual/dir destinations (no real posting).
2. Dashboard: per-channel schedule editor + Home "Coming up" update.

Not dropping bundle generation — "Create this week's content" still makes the full bundle on demand.
