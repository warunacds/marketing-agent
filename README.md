# marketing-agent

AI marketing agents for SaaS products, built in Python on the official
[OpenAI SDK](https://github.com/openai/openai-python) (Responses API).

Not one autonomous "marketer" — a set of narrow specialist agents (research,
SEO, writer, social, email, fact-check, analyst) that all work from a
per-product **brand brain** folder of markdown files, inlined into every
prompt. The same code covers any number of products; only `brands/<product>/`
differs. **Nothing publishes without a human approval recorded in the queue.**

## Layout

```
brands/<product>/       the brand brain: positioning, ICP, voice, features,
                        pricing, competitors, never-say, learnings
agents/*.md             system prompts for each specialist agent
marketing_agent/        Python package: runner + pipelines + approval CLI
queue/                  pending / approved / rejected drafts
runs/<date>/<product>/  step outputs + per-step token/cost log (costs.jsonl)
```

## Setup

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # add your OPENAI_API_KEY
```

Create a brand brain for your first product and fill in every file
(see `brands/README.md` — quality comes from here, not from the model):

```bash
cp -r brands/_template brands/my-product
```

## Model selection

Every model is selectable — pass any Responses-API model id:

- Per run: `python -m marketing_agent content --product my-product --model gpt-5.6-sol`
- Per environment: `MARKETING_MODEL` and `MARKETING_FACTCHECK_MODEL` in `.env`
- Defaults: `gpt-5.6-terra` for the main steps, `gpt-5.6-luna` for the
  fact-check gate (a cheap comparison task)

## Weekly content pipeline

```bash
python -m marketing_agent content --product my-product
```

Steps, each a single `responses.create()` call with its own system prompt and
the brand brain inlined:

1. **research** — scans competitors' changelogs, your ICP's communities, and
   the keyword space (built-in `web_search` tool); writes a 5-idea
   opportunities brief.
2. **seo** — picks the best idea, writes a content brief (keywords, intent,
   outline, meta). Search Console data is pulled automatically if configured in
   `channels.json` (`pip install google-auth` + a service-account file); or
   pass an export manually with `--gsc export.csv`.
3. **writer** — full blog post in the product's voice.
4. **social + email** (concurrent) — X thread, LinkedIn post, and a newsletter
   section derived from the post, so nothing drifts.
5. **fact-check** — a cheap model checks every product claim against
   `features.md`/`pricing.md` and `never-say.md`. Verdict: PASS or FAIL.
6. Drafts land in `queue/pending/<date>-<product>/`.

Then the human gate, and distribution:

```bash
python -m marketing_agent queue                       # list pending drafts
python -m marketing_agent approve 2026-08-26-my-product
python -m marketing_agent reject  2026-08-26-my-product --reason "off-voice"
python -m marketing_agent publish 2026-08-26-my-product            # all channels
python -m marketing_agent publish 2026-08-26-my-product --channel social
```

## Distribution

Per-product channel config in `brands/<product>/channels.json` (template
included). Every channel defaults to `manual` — the asset is printed for you
to copy — so publishing works before any API is wired up. Adapters:

| Channel     | Adapters | Notes |
|-------------|----------|-------|
| blog        | `dir`, `webhook`, `manual` | `dir` writes the post into a content folder you commit/deploy; `webhook` POSTs markdown to any CMS endpoint |
| social      | `typefully`, `webhook`, `manual` | creates a **draft** thread in Typefully (you hit publish there); LinkedIn is printed for manual posting |
| newsletter  | `resend`, `webhook`, `manual` | creates a **draft** broadcast in Resend (review and send there) |

Deliberately conservative: external adapters create drafts in those tools, not
live posts — the approval queue plus one click in the destination tool. Failed
channels are recorded in the item's manifest and can be retried;
already-published channels are skipped. When all three succeed the item moves
to `queue/published/`.

Notifications: set `SLACK_WEBHOOK_URL` and/or `TELEGRAM_BOT_TOKEN` +
`TELEGRAM_CHAT_ID` in `.env` and the content pipeline pings you when drafts
land in the queue (including the fact-check verdict).

## Weekly analyst

```bash
python -m marketing_agent report --product my-product --metrics metrics.md
```

Drop whatever numbers you have (Search Console, newsletter opens/clicks,
social stats) into a file and pass it. The analyst writes
`runs/<date>/<product>/report.md` and appends 2-3 lessons to
`brands/<product>/learnings.md`, which the writer reads the following week —
this is what makes the system improve rather than just produce.

## Scheduling

Any scheduler works; each run takes the product as a parameter:

```cron
0 9 * * 1  cd /path/to/marketing-agent && .venv/bin/python -m marketing_agent content --product my-product
0 9 * * 0  cd /path/to/marketing-agent && .venv/bin/python -m marketing_agent report  --product my-product
```

## Build order (what's here vs. next)

- [x] Brand-brain templates, all seven agent prompts
- [x] Weekly content pipeline end to end, fact-check gate, approval queue, cost logging
- [x] Weekly analyst writing lessons back into the brain
- [x] Distribution: `publish` command with per-product channel adapters
      (blog via dir/webhook, social via Typefully drafts, newsletter via Resend
      drafts, `manual` fallback everywhere)
- [x] Search Console auto-pull for the SEO agent (optional google-auth)
- [x] Approval notifications via Slack webhook / Telegram bot
- [ ] Analytics API pulls for the weekly report (beyond GSC: newsletter and
      social stats still arrive via `--metrics`)

Point it at one product first. When the drafts are things you'd actually post,
`cp -r` the brand folder for products two and three — same code, three brains.

## Cost & model notes

- Per-step tokens, estimated cost, and duration are logged to
  `runs/<date>/<product>/costs.jsonl`; the pipeline prints the run total.
- Cost estimates come from the price table in `marketing_agent/runner.py` —
  update it when OpenAI's price sheet changes; unknown models still log tokens.
- Agents have no file or shell access — research/SEO get web search, everything
  else is pure text in/out, and all files are written by pipeline code, so the
  write path is deterministic and auditable.
