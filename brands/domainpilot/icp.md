# Ideal customer profile

<!-- Drafted from site personas, outreach targeting, and plan structure
     (paths relative to /Users/waruna/DomainPilot/claude/). TODOs = guesses to confirm. -->

## Who
- Core: people who own 10–500 domains across multiple registrars. <!-- domain-pilot-website/app/pingdom-alternative/page.tsx:691 -->
- Segments the site names: founders/serial entrepreneurs with side projects; agencies managing client domains; SaaS teams (product + marketing + staging domains); domain investors; freelancers. <!-- pingdom-alternative/page.tsx:193-219 -->
- Segment actively prospected in outreach: WordPress maintenance / care-plan shops and one-person web studios managing many client sites. <!-- marketing/outreach-emails-2026-07-07.md (all 40 drafts target these) -->
- Plan mapping: Starter = solo founders/freelancers; Plus = agencies, SaaS teams; Pro = serious operations/investors. <!-- pingdom-alternative/page.tsx:512; lib/content/pricing.ts -->

## Where they hang out
- Own channels: r/DomainPilotApp, x.com/DomainPilotApp, LinkedIn company page. <!-- domain-pilot-website/config/site.ts -->
- Planned distribution targets: Show HN, Indie Hackers, r/sysadmin, r/webdev (via free tools). <!-- plans/engineering-as-marketing.md:42 -->
- TODO(user): confirm the communities that actually convert (WordPress agency communities? r/Domains? namepros.com for investors? newsletters?).

## What they're trying to do
- "Keep track of when client domains and SSL certs expire" across registrar accounts they don't control. <!-- outreach-emails-2026-07-07.md:20 -->
- Stop logging into 3–5 registrar dashboards to answer "where is example.com registered?" <!-- Problem.tsx:44-47 -->
- Get told *before* a domain/cert lapses or DNS changes — not by a client phone call. <!-- outreach-emails-2026-07-07.md:120 -->
- Give clients a professional status page without another tool.

## What they've tried
- A spreadsheet that "quietly became a lie" (founder story — our best-articulated enemy). <!-- content/articles/why-i-built-domain-pilot.mdx:39-41 -->
- Registrar renewal emails going to old/ignored inboxes. <!-- why-i-built-domain-pilot.mdx:43-45 -->
- Uptime-only tools (Pingdom) that can't see expiry/DNS/registrar problems. <!-- pingdom-alternative/page.tsx:250 -->
- WordPress-side tools (ManageWP et al.) that stop at the WordPress layer. <!-- outreach-emails-2026-07-07.md:36,106 -->
- TODO(user): confirm — do we hear UptimeRobot / Better Stack / DNSimple in sales conversations?

## Objections we hear
<!-- TODO(user): replace with objections actually heard; these are inferred from copy/FAQ. -->
- "Is it safe to hand over registrar API keys?" (answered by Trust/Security sections — AES-256, keys never shown). <!-- Trust.tsx:5-26; lib/content/faqs.ts:19 -->
- "My registrar already emails me before renewal."
- "We already have uptime monitoring."
- "My spreadsheet is free."
- "Yet another subscription" (countered by free tier, LTD, cost-of-losing-a-domain framing).

## Sophistication level
- Technical enough to find registrar API keys and read DNS records; not necessarily developers. Agencies/freelancers are semi-technical; SaaS teams and investors more so.
- Vocabulary that's safe: registrar, SSL cert, DNS record, nameserver, uptime. Avoid internals (TimescaleDB, Redis, hypertables) except in engineering-blog content. <!-- register: outreach emails vs BLOG.md -->
- TODO(user): confirm primary buyer (agency owner vs developer) for tone calibration.
