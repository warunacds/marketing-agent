# Positioning

<!-- Drafted from the live marketing site + repo (paths relative to
     /Users/waruna/DomainPilot/claude/). Items marked TODO are my guesses —
     confirm or rewrite. -->

## One-liner
Domain Pilot is the safety net for your domains: one dashboard to manage domains across every registrar — uptime, SSL, DNS, and renewal alerts included. <!-- adapted from domain-pilot-website/config/site.ts:4-6 ("Never Lose a Domain Again" / "Manage all your domains from one dashboard. Monitor uptime, edit DNS, track SSL, and get renewal alerts across GoDaddy, Namecheap, Cloudflare, and more.") -->

## Category
- Primary shelf: domain management / domain portfolio dashboard.
- Secondary shelf we deliberately borrow: uptime monitoring ("the Pingdom alternative built for domain owners"). <!-- domain-pilot-website/app/pingdom-alternative/page.tsx:246-247 -->
- Recurring metaphor in our copy: **insurance / safety net** ("The best insurance policy your business didn't know it needed"). <!-- Hero.tsx:32; about/page.tsx:158 -->
- TODO(user): confirm which shelf leads in new content — "domain management" or "uptime monitoring".

## Who it's for
Entrepreneurs, agencies, and developers who can't afford to lose a domain (details in icp.md). <!-- domain-pilot-website/components/landing/FinalCTA.tsx:26 -->

## The problem we solve
- Domains scattered across GoDaddy/Namecheap/Cloudflare accounts: "That's Not a Strategy. That's a Risk!" <!-- Problem.tsx:9 -->
- One missed renewal email = domain gone forever; renewal notices go to old/client inboxes. <!-- Problem.tsx:25-28,64-66 -->
- "Death by a Thousand Logins" — hunting across registrar dashboards. <!-- Problem.tsx:44-47 -->
- The failures live *outside* WordPress/hosting tooling: domain registration, SSL certs, DNS records at the registrar. <!-- marketing/outreach-emails-2026-07-07.md:50-52 -->

## Why us (differentiation)
- Registrar-agnostic layer: domains stay where they are; we connect via API to 11 registrars (13 in backend). We don't sell domains, host sites, or compete with registrars. <!-- about/page.tsx:188-192; features.md -->
- The whole ownership layer in one tool: expiry + SSL + DNS + uptime + status pages — not just uptime (Pingdom) and not just WordPress-side maintenance (ManageWP). <!-- pingdom-alternative/page.tsx:250; outreach-emails-2026-07-07.md:36 -->
- Alerts engineered not to spam: multi-region confirmation, flap digests, cooldowns, escalation caps (see features.md — all real, in code).
- Free forever for 5 domains; paid plans undercut a Pingdom+DNSimple stack. <!-- FinalCTA.tsx:37; pingdom-alternative/page.tsx:69 -->

## Proof
<!-- Numbers, customers, benchmarks we can actually cite. If it's not here, agents can't use it. -->
- "Over 100 million domains go unrenewed globally each year (Source: Verisign, Q2 2024)" — the only sourced stat on the site. <!-- Problem.tsx:65 -->
- Founder story: "I lost a domain and missed two weeks of downtime. So I built Domain Pilot" — Aslam Najeebdeen. <!-- content/articles/why-i-built-domain-pilot.mdx -->
- Testimonial in use: "Set it up in 2 minutes. Haven't logged into GoDaddy since." — Jorge S., Entrepreneur. TODO(user): confirm this is a real, permission-granted quote. <!-- Features.tsx:60-61 -->
- DO NOT use: "500+ users", "15,000+ domains", "99.9% platform uptime", "Zero domains lost" — that section is commented out of the site and unverifiable. <!-- app/page.tsx:74; SocialProof.tsx -->
- TODO(user): real customer count / domains-under-management we're comfortable citing, if any.

## Primary call to action
"Start Free. Connect Your Domains." → https://app.domainpilot.io/register
Supporting: "Free forever for up to 5 domains · No credit card required · Set up in 10 minutes". <!-- Hero.tsx:43; FinalCTA.tsx:34-39 -->
Secondary CTA: free tools, esp. "Try our free Domain Health Checker →" → domainpilot.io/domain-health-check. <!-- Hero.tsx:59 -->
