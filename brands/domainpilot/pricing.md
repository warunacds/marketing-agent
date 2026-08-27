# Pricing

<!-- Exact plans, prices, and what's in each. Agents never guess prices.
     Source of truth: domain_manager/db/seeds.rb:14-144 (tier config) and
     domain-pilot-website/lib/content/pricing.ts (public pricing section).
     Paths relative to /Users/waruna/DomainPilot/claude/. Verified 2026-08-27. -->

| Plan | Price | Includes |
|------|-------|----------|
| Free | $0 forever | 5 active domains, 15-min uptime checks, DNS management, email + push notifications, status pages, 2 AI reports/mo, 1 seat |
| Starter | $12/mo, or $9/mo billed annually ($108/yr) | 25 domains, 5-min checks, SSL monitoring, email + Slack, white-label status pages, 10 AI reports/mo, 3 seats |
| Plus ("Most popular") | $30/mo, or $24/mo billed annually ($288/yr) | 100 domains, 1-min checks, SSL monitoring, priority support, 30 AI reports/mo, 10 seats |
| Pro | $99/mo, or $79/mo billed annually ($948/yr) | 500 domains, 30-sec checks, SSL monitoring, priority support, 100 AI reports/mo, 25 seats. Annual Pro includes free white-glove setup ("$500 value") |
| Enterprise | Custom (contact sales) | Unlimited domains/seats/AI reports, 30-sec checks, custom integrations, dedicated support |

Annual billing = 20% off Starter/Plus/Pro. <!-- domain_manager/db/seeds.rb (yearly_discount_percent: 20) -->

## Lifetime deal (active offer)
- Tiered one-time pricing: Early Bird $149 (50 spots, active), Limited $199 (100 spots), Final $249 (150 spots) — "Limited to 300 lifetime members". <!-- domain-pilot-website/components/ltd/tierData.ts:13-49 -->
- Grants: 50 domains, unlimited registrars, 1-min checks, SSL monitoring, email + Slack alerts, 50 status pages*, 30 AI reports/mo, team collaboration, 90-day history, email support. (*status-page counts are copy, not enforced — see features.md) <!-- domain-pilot-website/components/ltd/tierData.ts:53-66 -->
- Lifetime holders can upgrade to Pro at a discount (default 25%). <!-- domain_manager/db/schema.rb:611-632 (lifetime_pro_discount_percent) -->
- TODO(user): the "spots remaining" number is inconsistent in the site source (287 hardcoded vs 37 computed). Confirm the real number before using scarcity copy.

## Trial / free tier
- Free plan is free forever, up to 5 domains, no credit card. <!-- domain-pilot-website/components/landing/FinalCTA.tsx:37-39; Hero.tsx:66,69 -->
- Paid plans: 14-day free trial, one-time only, available when upgrading from Free. <!-- domain_manager/app/controllers/api/checkout_controller.rb:644; domain_manager/app/models/user.rb:462-465 -->
- 30-day money-back guarantee on paid plans and the lifetime deal ("no questions asked"). <!-- domain-pilot-website/components/landing/Pricing.tsx:36; components/ltd/LtdFaq.tsx:60 -->
- Cancel anytime; Stripe billing portal for self-serve management. <!-- domain-pilot-website/components/landing/Pricing.tsx:36; domain_manager/config/routes.rb:565-576 -->

## What we say about price
- "The cost of losing just one [domain] is more than a year of Domain Pilot." <!-- domain-pilot-website/components/landing/FinalCTA.tsx:26 -->
- LTD framing: "$0.41/day for the first year — then completely free. Forever." <!-- domain-pilot-website/components/ltd/LtdHero.tsx:84 -->
- Vs Pingdom: "Pingdom Synthetic starts at $16.5/mo… Pingdom + DNSimple can run $42–267/mo" — undated competitor pricing; TODO(user): re-verify before reusing. <!-- domain-pilot-website/app/pingdom-alternative/page.tsx:69,604-606 -->
- Affiliate program: 30% recurring commission for customer lifetime, 60-day cookie, free to join. <!-- domain-pilot-website/app/affiliate/page.tsx:12-13 -->

## TODO(user)
- Confirm live Stripe prices match the seeded $12/$30/$99 (seeds are the intended config; Stripe is authoritative for what customers are actually charged).
- Confirm which LTD tier is currently on sale and real spots remaining.
- Enterprise: any actual pricing anchor, or keep pure contact-sales?
