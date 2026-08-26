# marketing-agent

AI marketing agents for SaaS products, built on the
[Claude Agent SDK](https://code.claude.com/docs/en/agent-sdk/python) (Python).

Not one autonomous "marketer" — a set of narrow specialist agents (research,
SEO, writer, social, email, fact-check, analyst) that all read a per-product
**brand brain** folder of markdown files. The same code covers any number of
products; only `brands/<product>/` differs. **Nothing publishes without a
human approval recorded in the queue.**

## Layout

```
brands/<product>/       the brand brain: positioning, ICP, voice, features,
                        pricing, competitors, never-say, learnings
agents/*.md             system prompts for each specialist agent
marketing_agent/        Python package: runner + pipelines + approval CLI
queue/                  pending / approved / rejected drafts
runs/<date>/<product>/  step outputs + per-step cost log (costs.jsonl)
```

## Setup

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # add your Anthropic Console API key
```

Create a brand brain for your first product and fill in every file
(see `brands/README.md` — quality comes from here, not from the model):

```bash
cp -r brands/_template brands/my-product
```

## Weekly content pipeline

```bash
python -m marketing_agent content --product my-product
```

Steps, each a single SDK `query()` call with its own system prompt:

1. **research** — scans competitors' changelogs, your ICP's communities, and
   the keyword space (web search); writes a 5-idea opportunities brief.
2. **seo** — picks the best idea, writes a content brief (keywords, intent,
   outline, meta). Pass `--gsc export.csv` to weight queries you already rank for.
3. **writer** — full blog post in the product's voice.
4. **social + email** (concurrent) — X thread, LinkedIn post, and a newsletter
   section derived from the post, so nothing drifts.
5. **fact-check** — a cheap model checks every product claim against
   `features.md`/`pricing.md` and `never-say.md`. Verdict: PASS or FAIL.
6. Drafts land in `queue/pending/<date>-<product>/`.

Then the human gate:

```bash
python -m marketing_agent queue                       # list pending drafts
python -m marketing_agent approve 2026-08-26-my-product
python -m marketing_agent reject  2026-08-26-my-product --reason "off-voice"
```

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
- [ ] Distribution: publish `queue/approved/` items (CMS via git/API, social via
      Typefully/Buffer, newsletter via Resend/Loops) — deliberately manual until
      the drafts are consistently worth posting
- [ ] Search Console API pull instead of manual `--gsc` exports
- [ ] Approval notifications (Slack/Telegram ping when drafts are queued)

Point it at one product first. When the drafts are things you'd actually post,
`cp -r` the brand folder for products two and three — same code, three brains.

## Cost & model notes

- Main steps run on `claude-opus-5`, the fact-check gate on `claude-haiku-4-5`
  (override with `MARKETING_MODEL` / `MARKETING_FACTCHECK_MODEL`).
- Per-step cost and duration are logged to `runs/<date>/<product>/costs.jsonl`;
  the pipeline prints the run total.
- Agents are read-only (Read/Glob/Grep + web where needed); all files are
  written by pipeline code, so the write path is deterministic and auditable.
