# Never say

<!-- Derived from the repo: claims the code can't back, claims deliberately removed
     from the site, and legal-page-only claims. Paths relative to
     /Users/waruna/DomainPilot/claude/. TODOs for the user at the bottom. -->

## Banned claims
- Never state a number (users, revenue, benchmark) that isn't in features.md or positioning.md.
- No customer/scale claims: "500+ users", "15,000+ domains protected", "Zero domains lost", "99.9% platform uptime" — that section is commented out of the site and unverifiable. No star ratings/reviews either (site policy: "no verifiable customer reviews yet"). <!-- domain-pilot-website/app/page.tsx:74; lib/schema.ts:124 -->
- No SLA, uptime guarantee, or service credits — none exist. Terms explicitly disclaim guaranteed renewal/uninterrupted service. <!-- domain-pilot-website/app/terms/page.tsx:147,223 -->
- No compliance claims: never claim SOC 2 (privacy policy says "in progress/planned" only), and never mention HIPAA, ISO 27001, or PCI at all. <!-- app/privacy/page.tsx:361 -->
- GDPR/CCPA: assert only in legal-page context, matching privacy/DPA wording — never as a marketing badge. <!-- app/privacy/page.tsx:46; app/dpa/page.tsx:41 -->
- Features that don't exist (see features.md "Explicitly NOT"): SMS alerts, domain registration/transfers, SSO/SAML, social login, on-call rotations, cron/heartbeat monitoring, RUM/page-speed, DNS-resolution or TCP checks, a released mobile app, outbound webhooks (unverified), Azure/Google Cloud DNS.
- No region-count claims ("6 regions", "14 regions") until the live count is confirmed — production config currently runs one region. <!-- uptime-service/fly.toml:18-24 -->
- Never "checks every 1 to 60 minutes" — correct range is 30 sec – 15 min by plan.
- Never promise SSL-expiry *emails* (SSL alerts go to push/Slack/in-app only). <!-- domain_manager/app/services/notifications/email_service.rb:57-61 -->
- Never promise raw uptime data beyond 7 days (90-day aggregates are the citable history).
- No security claims beyond the security page's exact wording; don't freestyle "zero-knowledge", "military-grade", or "unhackable". <!-- app/security/page.tsx; app/privacy/page.tsx:368 -->
- No LTD scarcity numbers ("287 spots") until reconciled — three sources disagree. <!-- Pricing.tsx:139 vs LtdHero.tsx:11,44 -->
- Don't invent uptime-percentage numbers for customers' sites or for us.

## Banned words & phrases
- TODO(user): none defined yet. Candidate from observed style: the hype register ("Join 500+ Entrepreneurs Who Sleep Better at Night" was cut from the site).

## Topics we stay out of
- TODO(user)
- Suggested from repo posture: no trash-talking registrars — footer says "Domain Pilot is not affiliated with or endorsed by any listed registrar" and the product depends on their APIs. <!-- Footer.tsx:107 -->

## Legal / compliance
- Legal entity is Frontcube LLC — don't invent a "DomainPilot Inc." <!-- Footer.tsx:104 -->
- Trademark care: registrar names/logos are their owners' property; keep the non-affiliation disclaimer when listing them. <!-- Footer.tsx:107 -->
- Money-back guarantee: only the exact "30-day money-back guarantee" as worded on the site — no broader "risk-free" language. <!-- Pricing.tsx:36 -->
- TODO(user): anything else (e.g. jurisdictions, advertising rules for the affiliate program)?
