# Brand brains

One folder per product. Every agent reads the relevant product's folder before
doing anything — this is where output quality comes from.

## Setup for a new product

```bash
cp -r brands/_template brands/<product-slug>
```

Then fill in every file. Ten focused minutes per file beats vague one-liners:
the agents can only be as specific as what's written here.

## Files

| File            | Purpose |
|-----------------|---------|
| `positioning.md` | What the product is, for whom, and why it wins |
| `icp.md`         | Ideal customer profile — who we write for |
| `voice.md`       | Tone of voice, with real do/don't examples |
| `features.md`    | **The only source of truth for product claims.** The fact-check agent rejects any claim not backed by this file |
| `pricing.md`     | Plans and prices, so agents never guess |
| `competitors.md` | Who we compete with and how we talk about them |
| `never-say.md`   | Banned claims, words, and topics |
| `learnings.md`   | Appended by the analyst agent weekly; read by the writer |

Keep these current. When you ship a feature, update `features.md` the same day —
otherwise the fact-check gate will (correctly) flag posts about it.
