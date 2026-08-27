# Competitors

<!-- One section per competitor. The research agent scans these weekly.
     Only Pingdom is documented in the repo (dedicated comparison page);
     everything else is TODO. Paths relative to /Users/waruna/DomainPilot/claude/. -->

## Pingdom
- What they are: uptime/synthetic monitoring (SolarWinds). Our only published comparison. <!-- domain-pilot-website/app/pingdom-alternative/page.tsx -->
- Where they beat us (publicly conceded on our own page): Real User Monitoring, synthetic transaction monitoring at enterprise scale, page-speed diagnostics; and "you don't own domains" cases. <!-- pingdom-alternative/page.tsx:894-897 -->
- Where we beat them: domain expiry + SSL + DNS + registrar inventory alongside uptime; free forever tier vs 14-day trial; price (their Synthetic starts ~$16.5/mo, undated claim). <!-- pingdom-alternative/page.tsx:77,69 -->
- How we talk about them: direct, by name, with an "Honest take" section conceding where they win. Keep that pattern — comparison honesty is part of the voice. <!-- pingdom-alternative/page.tsx:875-878 -->
- Changelog/blog URL: TODO

## DNSimple
- Mentioned only as the DNS half of a "Pingdom + DNSimple $42–267/mo" cost stack on the comparison page — not a fleshed-out competitor. TODO(user): expand or drop. <!-- pingdom-alternative/page.tsx:604-606 -->

## TODO(user): likely competitors not documented anywhere in the repo
- UptimeRobot / Better Stack / Hetrix / StatusCake (uptime shelf)
- MXToolbox (free-tools shelf — named as the model in plans/engineering-as-marketing.md:35)
- Domain-portfolio tools (Domain Punch, Watch My Domains, registrar-native dashboards)
For each: what they are, where they beat us, where we beat them, how we talk about them, changelog URL.

## Indirect alternatives
- The spreadsheet ("the spreadsheet quietly became a lie") — our best-documented enemy. <!-- content/articles/why-i-built-domain-pilot.mdx:39-41 -->
- Registrar renewal emails + auto-renew and hoping. <!-- Problem.tsx:25-28 -->
- WordPress-side maintenance tools (ManageWP et al.) — "the layer WordPress-side tools skip"; adjacent, not competitive; we position as their complement. <!-- marketing/outreach-emails-2026-07-07.md:36,106 -->
- Doing nothing ("None of this feels urgent until it happens to you."). <!-- Problem.tsx:74 -->
