# Spec — Phase 3: channels, learning loop, brand TODOs, product wizard

Status: SHIPPED 2026-08-27 (backend + both dashboard rounds, verified). Scope: features 2–5 from the roadmap; deploy (1) deferred — local use for now.

## 2. Real publishing channels

Goal: Approve → Publish actually delivers, configured entirely from the dashboard.

Backend:
- `GET /api/channels/{product}` → parsed channels.json (blog/social/newsletter entries incl. type + config; `_`-prefixed example keys stripped).
- `PUT /api/channels/{product}` → validate (known adapter types; required fields per type: dir→path, webhook→url, typefully→api_key_env, resend→api_key_env+audience_id+from) and write channels.json.
- `POST /api/channels/{product}/test` {channel} → run the real adapter with a clearly-marked TEST asset. Typefully/Resend create **drafts** labeled TEST (nothing auto-sends); dir writes `_test-<ts>.md`; webhook POSTs a test payload; manual returns the text. Response {output} or 400 with the adapter error.
- Secrets (API keys live in env, not channels.json): `GET /api/secrets?names=A,B` → [{name, set}] (never values). `PUT /api/secrets` {name, value} → upsert into repo `.env` + live process env. Name must match `^[A-Z][A-Z0-9_]{2,63}$`; refuses to overwrite `OPENAI_API_KEY`/`MARKETING_API_KEY` (guard rails).

Dashboard (Product info → "Publishing" card per product): per channel pick where it goes (Copy by hand / Folder / Webhook / Typefully / Resend), type-specific fields, inline secret entry when the env var is missing ("Paste your Typefully API key — stored on the server, never shown again"), Save, "Send test".

## 3. Learning loop

- `weekly_report.run`: when no `--metrics` file, auto-pull Search Console via the existing `fetch_gsc_data` + the brand's `channels.json` "gsc" config (non-fatal if unconfigured; the report says what data it had).
- Schedule: `schedule.json` gains flat keys `report_enabled`, `report_day`, `report_hour`, `report_last_run`; the scheduler tick starts report jobs the same way as content. `PUT /api/schedule/{product}` accepts the new optional fields.
- Dashboard: "Weekly reports" section (Activity page): list report.md runs by date, render the report, note when lessons were appended. Schedule card gains a second block: "Weekly report" toggle + day/hour.
- Already built (no work): analyst agent, lessons appended to learnings.md, learnings read by writer/social next run.

## 4. Brand-brain TODO tracker

- `GET /api/brands/{product}/todos` → scan brand *.md for lines containing "TODO" → [{file, line, text}].
- `POST /api/brands/{product}/todos/resolve` {file, todo, answer} → new `brand_editor` agent rewrites JUST that file: incorporates the answer where the TODO sits, removes the TODO, changes nothing else, returns the full file; API saves it. Sync endpoint (seconds on the cheap model); cost logged to today's run dir.
- Dashboard (Product info): "Open questions (N)" card per product, grouped by file: TODO text + answer box + "Apply answer" (spinner while the AI edits), plus "edit the file yourself" fallback link. Copy: "Answer these to make the AI more accurate."

## 5. Smaller items

- **Add a product**: `POST /api/products` {name, description?} → copy `brands/_template` → `brands/<name>`. With a description: also spawn a `brandgen` job (new CLI command + `brand_builder` agent) that drafts positioning/icp/voice/features/pricing/never-say/competitors from the description, marking every guess TODO (feeding the TODO tracker). Dashboard: "Add a product" button → name + optional "Describe your product" textarea → job progress → lands on the new product's page.
- **Approver identity**: login page gains optional "Your name" (stored in a cookie); approve passes it; manifest `approved_by` records it (falls back to the server user). `approve()` gains a `by=` param.
- **Structured conflicts**: approve/edit/revise 409s change from bare strings to `{message, code}` with codes `factcheck_fail` / `factcheck_stale` / `revising`; dashboard switches on `code` instead of regex-matching message text.

## Build order

A. Backend: channels+secrets → report/GSC+schedule → todos+brand_editor agent → products+brandgen → approver+structured 409s. Tested via curl/scripts per feature.
B. Dashboard round 1: Publishing card, secrets, test buttons, structured-409 switch, approver name, report schedule.
C. Dashboard round 2: Weekly reports view, TODO tracker, Add-a-product wizard.

Non-goals this phase: deployment kit, multi-user accounts, per-post GSC drill-down beyond the report.
