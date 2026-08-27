# Dashboard redesign — product-centric, calm & approachable

The dashboard grew feature-by-feature and reads as a pile of cards. This redesign
gives it one mental model (**"You have products. For each, the AI drafts marketing,
you approve it, it goes out, it learns."**), a real home screen, and a warm, calm
visual system a non-technical marketer isn't intimidated by. The API/actions/state
layer (`lib/api.ts`, `lib/actions.ts`, `lib/state.ts`) is solid — reuse it; this is
information architecture, language, flow, and visual design.

## 1. Design system (build this first, in globals.css + fonts)

**Fonts** (next/font/google — this is an app, not a CSP-restricted artifact):
- Display / headings: **Bricolage Grotesque** (600/700). Characterful, friendly, not Inter/Space-Grotesk.
- Body / UI: **Hanken Grotesk** (400/500/600). Warm, highly legible at small sizes.
- Mono (commands, data, costs): **IBM Plex Mono** (400/500).
Set CSS vars `--font-display`, `--font-sans`, `--font-mono`; base size 15px, line-height 1.55.

**Palette** — warm paper ground, deep ink, one confident green accent, amber for
"needs you". Deliberately NOT the cream+terracotta / near-black+acid / purple-gradient
AI clichés. Define as tokens on `:root`, redefine under
`@media (prefers-color-scheme: dark) :root:not([data-theme=light])` AND `:root[data-theme=dark]`.

Light:
- `--bg` #FAF9F6 (warm paper)   `--surface` #FFFFFF   `--surface-sunk` #F3F1EC
- `--ink` #22201C (warm near-black)   `--muted` #6B665D   `--line` #E4E0D8
- `--accent` #2F7A55 (sea green)   `--accent-ink` #1E5238   `--accent-soft` #E7F1EA
- `--attention` #9A6212 (amber, "waiting for you")   `--attention-soft` #F7EEDD
- semantic: `--good` #2F7A55  `--warn` #9A6212  `--bad` #B0402F  each with a `-soft`

Dark:
- `--bg` #17150F   `--surface` #201D16   `--surface-sunk` #14120D
- `--ink` #EFEBE1   `--muted` #A29B8C   `--line` #332E23
- `--accent` #6FB98C   `--accent-ink` #A9D9BD   `--accent-soft` #1E3A2A
- `--attention` #D6A44E   `--attention-soft` #3A2E14
- `--good` #6FB98C  `--warn` #D6A44E  `--bad` #E0846F  each with a dark `-soft` fill.
- semantic tuned for the dark ground (lighter text/icons, low-chroma soft fills).

**Shape & depth**: radius `--r` 12px (cards), 8px (inputs/buttons), 999px (pills).
Soft borders (`1px var(--line)`), one restrained shadow token `--shadow: 0 1px 2px rgba(30,25,15,.04), 0 4px 16px rgba(30,25,15,.05)` (drop shadows in dark mode, use border emphasis instead). Generous spacing scale (4/8/12/16/24/32/48).

**Primitives to restyle** (keep shadcn structure, re-skin via tokens): Button
(primary = accent fill, white ink; secondary = surface + border; ghost; destructive),
Card (surface, radius, soft shadow), Badge/Pill, Input/Textarea/Select, Tabs, Dialog.
Add a **StatusPill** (color+shape by state) and an **EmptyState** (icon, one-line what
+ one primary action) primitive — both used everywhere.

**Motion**: subtle only. 150ms ease on hover/press; respect `prefers-reduced-motion`.

## 2. Information architecture & routing

Everything is scoped to a **current product** carried in the URL.

```
/                         → redirect to /p/<first product> ; if no products → /welcome
/welcome                  → first-run: big "Add your first product" (the add-product wizard)
/login                    → unchanged (re-skinned)
/p/[product]              → HOME (overview)
/p/[product]/review       → REVIEW (drafts queue for this product)
/p/[product]/review/[state]/[slug]  → item detail
/p/[product]/publishing   → PUBLISHING (where content goes + logins + schedule)
/p/[product]/knowledge    → KNOWLEDGE (brand brain files + open questions)
/p/[product]/knowledge/[file]       → single brand file editor
/p/[product]/activity     → ACTIVITY (runs, reports, costs)
/p/[product]/activity/[id]          → job log
```

**Top bar** (AppShell, on every /p/* page): left = **Product switcher** (dropdown of
products + "+ Add product" → wizard; shows current product name in Bricolage). Center/left
nav = Home · Review · Publishing · Knowledge · Activity (Review shows a count badge when
items await). Right = theme toggle + a small user menu (Log out). Mobile: nav collapses to
a menu. All nav links preserve the `[product]` segment.

**Data scoping**: filter `/api/queue` items by `manifest.product === product`; filter
`/api/runs`, `/api/jobs` rows by product. The Review count badge = pending items for this product.

## 3. Screens

### /welcome (first run / no products)
Centered, friendly: one line "Let's set up your first product," a short "the AI will learn
about it and start drafting," and the add-product wizard inline (name + optional description).
On create, route to that product's Home.

### HOME — /p/[product]
The "what do I do now?" screen. Sections top to bottom:
1. **Header**: product name (display face) + one-line subtitle "Your AI marketing desk."
   Primary button **"Create this week's content"** (opens the create dialog with instructions box).
2. **Waiting for you** card: count of drafts awaiting review; if >0, list the newest 1–3 with a
   "Review" button → item page; if 0, calm empty state "Nothing to review right now." Amber accent when >0.
3. **Coming up** card: the schedule in plain words — "New content drafts every Monday at 9:00" /
   "Reports every Friday" / or "No automatic schedule yet — set one up in Publishing." Show
   next run and whether posting is set up (channels configured / logged in).
4. **Recently published** card: last 2–3 published items with where they went; else empty state.
5. **A gentle "needs attention" strip** only if something's off: open questions count
   ("N open questions about your product → answer them so drafts get more accurate"),
   or "Your X login expired," or "No publishing set up yet." Each links to the fix.

### REVIEW — /p/[product]/review
The queue, but calmer. Four groups with plain headers and counts, most-actionable first:
"Waiting for your review" (amber), "Approved — ready to publish", "Published", "Didn't use"
(rejected). Each item = a card: date (human), what's inside ("Blog post · social · newsletter"),
fact-check as a StatusPill ("✓ Checked" / "⚠ Read before approving" / "⚠ Edited since checked"),
and a primary action inline (Review / Publish). Empty groups collapse to one calm line.
Item detail page keeps all existing actions (approve/reject/revise/edit/re-check/publish, tabs,
receipts) — restyled to the system, tabs renamed already ("Blog post / Social posts / Newsletter
/ Fact-check report / Working notes").

### PUBLISHING — /p/[product]/publishing
"Where your content goes, and when." Two blocks:
1. **Channels**: the publishing-card content (blog / social destinations / newsletter), incl.
   browser logins (X/Reddit/LinkedIn with the in-dashboard Log in / I've finished / Cancel / Log out),
   dry-run, subreddit, secrets — restyled into the system. Lead with a one-line explainer.
2. **Schedule**: the schedule-card (weekly content + weekly report), plain-language.
Keep all current functionality; just give it hierarchy and breathing room.

### KNOWLEDGE — /p/[product]/knowledge
"What the AI knows about your product." Intro line: "Everything the AI reads before it writes.
Every claim in your content is checked against these notes." Two parts:
1. **Open questions** (the TODO tracker) surfaced FIRST when N>0, as the highest-value action.
2. **The notes**: the brand files as a friendly list (friendly labels, not filenames) → each opens
   the editor. Keep the AI "apply answer" flow.

### ACTIVITY — /p/[product]/activity
"History." De-emphasized reference. Three tabs or sections: **Runs** (past content runs, open the
drafts), **Reports** (rendered weekly reports), **Cost** (per-run cost, plain total + expandable
step table). Jobs currently running show at top with the auto-refresh. Job log detail page kept.

## 4. Copy rules
Plain, warm, verb-first. Never expose: queue/manifest/slug/pipeline/adapter/webhook/env var/
factcheck-verdict-strings. Say "drafts", "waiting for you", "where content goes", "what the AI
knows", "checked against your product facts". Buttons say what happens. Empty states teach the
next step, never just "No data".

## 5. Build phases
1. **Foundation**: fonts + globals.css tokens + restyled primitives + StatusPill/EmptyState +
   AppShell (top bar, product switcher, new nav) + routing restructure (/p/[product]/*, root
   redirect, /welcome). Every existing page reachable at its new path, functionality intact.
2. **Home** + **Review** (daily-use core) on the new system.
3. **Publishing** + **Knowledge** + **Activity**.
4. **Polish**: empty states, responsive, dark-mode pass, consistency sweep, kill dead components.

Nothing from today's feature set is dropped — it's relocated per §3. Verify `npm run build`
clean after every phase.
