# Features — source of truth

<!-- THE RULE: if a capability is not listed here, agents must not claim it.
     The fact-check agent flags any product claim it can't trace to this file.
     Keep this current: update it the day a feature ships or is removed. -->

<!-- CITATIONS: every path below is relative to the product repo root
     /Users/waruna/DomainPilot/claude/. Facts were derived from code on 2026-08-27.
     Docs in that repo contradict each other (README, CLAUDE.md, SUBSCRIPTION_TIERS.md
     are variously stale); code and seeds win. See "Caveats" at the bottom for
     marketing claims that do NOT match the code. -->

## Core features

### Multi-registrar domain dashboard
- Connect registrar accounts via API key and sync domains into one dashboard; domains stay at their registrar (no transfer). <!-- domain_manager/app/services/registrar_service.rb:31-61 (fetch_domains), domain-pilot-website/config/site.ts:4 -->
- 13 registrars implemented in the backend: GoDaddy, Namecheap, Cloudflare, Name.com, IONOS, NameSilo, Epik, Porkbun, Hostinger, AWS Route 53, Vercel, Dynadot, DigitalOcean. <!-- domain_manager/app/models/registrar.rb:9-21; dispatch tables domain_manager/app/services/registrar_service.rb:31-94 -->
- BUT the dashboard UI shows IONOS and DigitalOcean as "coming soon" (disabled), so users can self-connect 11. Marketing site says "9 registrars". Use "11" for user-facing claims until UI is updated. <!-- domain_manager_frontend/src/app/(dashboard)/registrars/new/page.tsx:279,296,712; domain-pilot-website/app/pingdom-alternative/page.tsx:65 -->
- Sync of registration dates, expiry, auto-renew status and DNS; manual re-sync per registrar and sync-all; sync-failure surfacing with dismiss/retry. <!-- domain_manager/config/routes.rb:510-524 -->
- Bulk activate/deactivate domains. <!-- domain_manager/config/routes.rb:436-440 -->
- Unlimited registrar connections on every plan (limit is on active domains, not connections). <!-- domain_manager/db/seeds.rb:29 ("Unlimited registrar connections") -->

### Domain expiry tracking & renewal alerts
- Expiry alerts at 90, 60, 30, 14, 7, 3 and 1 days before expiration by default; schedule is user-overridable. <!-- domain_manager/app/jobs/domain_expiration_alert_job.rb:40,173-185 -->
- Email templates exist for: domain_down, domain_recovery, still_down_escalation, backoff_entered, domain_dns_changed, domain_expiring, domain_expired, domain_parked, domain_parked_recovery, domains_disabled_by_plan, flap_digest, monitoring_paused, monitoring_stopped. <!-- domain_manager/app/views/domain_alert_mailer/ -->

### Uptime monitoring
- HTTP/HTTPS checks from a Go monitoring service; configurable HTTP method, request body/headers, timeout (default 20s), expected status codes, and check path. <!-- uptime-service/internal/checker/http_checker.go:208,239,245; domain_manager/app/services/domain_monitor_broadcaster.rb:40-51 -->
- Keyword / expected-text matching on the response body (case-insensitive option). <!-- uptime-service/internal/checker/http_checker.go:275-282,906-912 -->
- Three redirect modes: follow (default), no_follow, expect_redirect; redirect chain and hop timings recorded. <!-- uptime-service/internal/checker/http_checker.go:255-268,56-90 -->
- Parked-domain detection (scans body for parking-page markers: GoDaddy, Sedo, HugeDomains, Afternic, etc.), with parked/recovery alerts. <!-- uptime-service/internal/checker/parking_detector.go:19-68; domain_manager/app/views/domain_alert_mailer/ -->
- Check intervals by plan: 30 sec (Pro/Enterprise), 1 min (Plus), 5 min (Starter), 15 min (Free). <!-- domain_manager/db/seeds.rb:14-144 (ping_interval_minutes); uptime-service/internal/scheduler/scheduler.go:270-273 -->
- Downtime backoff: after 60/120/240 min down, checks slow to 10/15/30 min; monitoring pauses after 24h down and stops (with email) after 7 days down. <!-- domain_manager/app/services/domain_monitor_broadcaster.rb:20-25; domain_manager/config/initializers/good_job.rb:142-145 -->
- Per-ping region tagging; per-region response-time data. <!-- uptime-service/internal/store/timescale_store.go:113-117 -->
- Uptime history: raw pings retained 7 days; hourly/daily aggregates retained 90 days; status pages and dashboards read the 90-day aggregates. <!-- domain_manager/db/telemetry_migrate/20260611000001_shrink_pings_retention.rb:34-39; domain_manager/app/controllers/api/status_controller.rb:20 -->
- Real-time dashboard updates over WebSockets (Action Cable + Redis pub/sub). <!-- domain_manager/config/routes.rb:742; BLOG.md:390-407 -->
- On-demand "check now" and test-check endpoints. <!-- domain_manager/config/routes.rb:441-470 -->
- MONITORING REGIONS — treat with care: production is currently scaled down to ONE region (sin) since 2026-06-11; the Fly multi-region deploy script defines iad/fra/sin; marketing claims "6 regions"; blog/whitepaper claim 14. TODO(user): confirm the live region count before any region claim. <!-- uptime-service/fly.toml:1-2,18-24; uptime-service/deploy-multi-region.sh:20-21; domain-pilot-website/components/landing/Features.tsx:166-174 -->

### SSL certificate monitoring
- TLS certificate checks (expiry date, days-until-expiry, issuer, subject, serial) run every 6 hours. <!-- uptime-service/internal/checker/ssl_checker.go:51-64; uptime-service/cmd/server/main.go:316 -->
- Paid plans only: SSL monitoring is blocked on Free ("requires a Starter or higher plan"). <!-- domain_manager/app/controllers/api/domains_controller.rb:92,348-351 -->
- SSL alerts are delivered via push, Slack and in-app web notifications — there is NO email template for ssl_expiring/ssl_expired (email path is a deliberate no-op). Do not promise "SSL expiry emails". <!-- domain_manager/app/services/notifications/email_service.rb:57-61 -->
- SSL check history retained 1 year. <!-- domain_manager/db/telemetry_migrate/20260108000001_create_telemetry_hypertables.rb:236 -->

### DNS management
- View/create/update/delete DNS records (A, CNAME, MX, TXT, NS per marketing; full CRUD implemented for all 13 registrars). <!-- domain_manager/app/services/registrar_service.rb:64-192; domain_manager/config/routes.rb:479-484 -->
- Split DNS: registrar and DNS provider can differ; DNS-only providers implemented: Vercel, Netlify, DigitalOcean, Cloudflare, AWS Route 53. <!-- domain_manager/app/models/dns_provider.rb:26-29; domain_manager/app/services/dns_provider_adapter.rb -->
- DNS provider auto-detection and assignment per domain. <!-- domain_manager/config/routes.rb:441-470 (detect_dns_provider, assign_dns_provider) -->
- Nameserver read on all 13 registrars; nameserver write on 9 (GoDaddy, Namecheap, Name.com, IONOS, NameSilo, Epik, Porkbun, Hostinger, Dynadot); Cloudflare/Route53/Vercel/DigitalOcean are read-only for nameservers. <!-- domain_manager/app/services/registrar_service.rb:199-279 -->
- DNS change detection with alert email and acknowledge flow. <!-- domain_manager/config/routes.rb:441-470 (acknowledge_dns_changes); domain_manager/app/views/domain_alert_mailer/ (domain_dns_changed) -->
- DNS audit logs, user-visible per domain (2-year retention). <!-- domain_manager/config/routes.rb:485; domain_manager/db/telemetry_migrate/20260108000001_create_telemetry_hypertables.rb:239 -->

### Alerts & notifications
- Channels that actually work: email (all plans), Slack (Starter+, via OAuth incoming webhook), mobile push via OneSignal (all plans), in-app/web notifications (all plans). SMS is a stub — see "Explicitly NOT". <!-- domain_manager/app/services/notification_service.rb:10-77; domain_manager/db/seeds.rb:14-144 -->
- Slack integration is one-click OAuth (incoming-webhook scope) with test-message endpoint. <!-- domain_manager/app/services/slack_oauth_service.rb; domain_manager/config/routes.rb:624-628 -->
- Per-notification-type × per-channel preference matrix; test buttons for email/Slack/push/web. <!-- domain_manager/app/models/user.rb:615-629; domain_manager/config/routes.rb:557-562 -->
- Anti-noise machinery (genuinely differentiating, all in code):
  - Multi-region confirmation: alert only after 2+ regions fail within 5 min (auto-adjusts to 1 for single-region domains). <!-- domain_manager/app/models/domain.rb:188-189,226-233; domain_manager/app/services/alert_detection_service.rb:36-54 -->
  - Sensitivity setting: alert after 1 (sensitive) / 2 (balanced, default) / 3 (conservative) consecutive failures. <!-- domain_manager/app/models/notification_preference.rb:6-10 -->
  - Per-domain cooldown (default 15 min, configurable 5–1440). <!-- domain_manager/app/models/notification_preference.rb:13; domain_manager/app/jobs/process_domain_alert_job.rb:44-52 -->
  - Flap detection: 3+ up/down transitions in an hour switches to a single hourly digest email until stable. <!-- domain_manager/app/models/domain.rb:247-249; domain_manager/app/jobs/flap_digest_job.rb:27-70 -->
  - Escalation reminders for still-down domains, capped (default 3 per alert, tier-configurable). <!-- domain_manager/app/jobs/escalation_check_job.rb:19-20 -->

### Incident management
- Per-domain incidents: create/edit, statuses (new, investigating, monitoring, waiting, resolved), plus a global incident feed and down-domains view. <!-- domain_manager/app/models/incident.rb:9-15; domain_manager/config/routes.rb:486-490,601-605 -->
- Optional publication of incidents to the public status page with separate public title/description. <!-- domain_manager/db/schema.rb:594,597-598 -->
- AI-generated incident postmortems. <!-- domain_manager/app/services/ai/postmortem_generator.rb; domain_manager/config/routes.rb:486-490 -->

### AI reports
- Four AI features: domain health analysis, incident postmortems, response-time analysis, and daily domain-content classification (normal/parked/coming_soon/hijacked/suspended/expired). <!-- domain_manager/app/services/ai/domain_analysis_generator.rb, postmortem_generator.rb, response_time_analysis_generator.rb, domain_content_analyzer.rb:27 -->
- Monthly AI-report quotas by plan: Free 2, Starter 10, Plus 30, Pro 100, Enterprise unlimited; quota charged to the team owner. <!-- domain_manager/db/seeds.rb:14-144; domain_manager/app/models/user.rb:512-536 -->
- Automatic (cron) response-time analysis is Plus/Pro/Enterprise only; on-demand generation open to all tiers within quota. <!-- domain_manager/app/services/ai/response_time_analysis_generator.rb:5 -->
- Provider: Anthropic by default (claude-haiku-4-5), switchable to OpenAI via AI_PROVIDER env. Internal detail — do not market model names. <!-- domain_manager/app/services/ai/client.rb:10-27 -->

### Public status pages
- Per-domain public status page at a token URL: live status, 90 days of daily uptime, uptime %, avg response time, recent pings with region, published incidents. Rate-limited public JSON API. <!-- domain_manager/app/controllers/api/status_controller.rb:5-77; domain_manager/config/routes.rb:9,12-13 -->
- Custom status-page domain (e.g. status.client.com) with verification, backed by Cloudflare for SaaS (or Vercel), including auto-adding the CNAME via the connected DNS provider. No tier gate in code. <!-- domain_manager/app/controllers/api/domains_controller.rb:595-655,641-645; domain_manager/db/schema.rb:315-320 -->
- Custom accent color on all plans; hiding "DomainPilot" branding (white-label) requires Starter+ (re-checked at render time). <!-- domain_manager/db/schema.rb:375; domain_manager/app/controllers/api/domains_controller.rb:764; domain_manager/app/models/domain.rb:840; domain_manager/db/seeds.rb:26,50 -->
- Embeddable single-file status page (pure HTML/JS, self-hostable on any static host). <!-- domainpilot-status-page/README.md:1-26 -->
- NOTE: pricing copy says "5/25/100/500 status pages" per plan but NO count limit exists in code — the effective cap is max_domains. Don't lean on the per-plan status-page numbers. <!-- domain_manager/db/seeds.rb:35 (feature string only); no max_status_pages column in domain_manager/db/schema.rb -->

### Teams
- One implicit team per account; roles: owner / admin / member. Seats by plan: Free 1 (solo), Starter 3, Plus 10, Pro 25, Enterprise unlimited; pending invitations hold a seat; invites expire after 7 days and can be resent. <!-- domain_manager/db/seeds.rb:14-144 (max_team_members); domain_manager/app/controllers/api/team_invitations_controller.rb:51-58; CLAUDE.md:146-169 -->

### Accounts & security
- Email/password auth plus passwordless magic-link login. <!-- domain_manager/config/routes.rb:390-400 -->
- TOTP two-factor auth with backup codes; once enabled, 2FA cannot be disabled, only reconfigured. <!-- domain_manager/config/routes.rb:403-408; CLAUDE.md:196 -->
- Session/device management: list sessions, revoke one or all others. <!-- domain_manager/config/routes.rb:411-415 -->
- Registrar credentials are stored encrypted; encryption keys live in AWS Secrets Manager. Site/DPA claim "AES-256-GCM zero-knowledge, client-side encryption with password-derived keys" — repeat only the security page's exact wording. TODO(user): confirm the zero-knowledge/client-side claim matches implementation before using it in new copy. <!-- domain_manager/app/services/secrets_manager.rb; domain-pilot-website/app/dpa/page.tsx:423; domain-pilot-website/app/security/page.tsx:45 -->
- Cloudflare Turnstile bot protection on public endpoints. <!-- domain_manager/app/services/turnstile_service.rb -->
- Registrar-side audit logging (API-key access, DNS/nameserver changes, sync events; 2-year retention) — internal only, no user-facing read endpoint yet. <!-- domain_manager/app/services/registrar_audit_service.rb:6-39 -->

### AI-agent (MCP) access
- First-party MCP server exposing 15 tools (list/get/add domains, dashboard stats, DNS record CRUD + acknowledge changes, SSL status, uptime stats, incidents, health checks, toggle monitoring, AI analysis). Bearer-token auth; stdio and HTTP transports. <!-- domainpilot-mcp/src/tools/*.ts; domainpilot-mcp/src/index.ts:7; domainpilot-mcp/src/http-app.ts:43-95 -->
- MCP tokens are minted in Settings → MCP; minting requires 2FA after a grace period. <!-- domain_manager/app/controllers/api/v1/mcp_tokens_controller.rb:30-37; domain_manager_frontend/src/app/(dashboard)/settings/mcp -->

### Free public tools (no signup)
- Domain health check (0–100 score) with email lead-report; domain search + instant search; DNS propagation checker; SSL expiry checker; domain registration expiry checker; what-is-my-IP; one-shot expiry email reminders (with unsubscribe). <!-- domain_manager/config/routes.rb:16-63; domain-pilot-website/app/{domain-health-check,domain-search,dns-propagation-checker,ssl-expiry-checker,domain-expiry-checker,what-is-my-ip}/ -->
- DNS Propagation Checker mechanics: queries 10 major public resolvers concurrently (Google, Cloudflare, Quad9, OpenDNS, Verisign, AdGuard, CleanBrowsing, Control D) and reports whether they agree (consensus + per-resolver answers). It measures resolver/provider cache diversity from a single host — NOT geographic vantage points. Say "across major public resolvers", never "from multiple locations/countries". <!-- domain_manager/app/services/domain_health/dns_propagation_check.rb:23-40 ("this is resolver/provider diversity ... not geography"); domain_manager/app/controllers/api/dns_propagation_controller.rb:2-11 -->

## Integrations
- Registrars (13 backend / 11 in UI): see Core above. <!-- domain_manager/app/models/registrar.rb:9-21 -->
- DNS-only providers: Vercel, Netlify, DigitalOcean, Cloudflare, Route 53. <!-- domain_manager/app/services/dns_provider_adapter.rb -->
- Slack (OAuth, incoming webhooks). <!-- domain_manager/app/services/slack_oauth_service.rb -->
- Stripe: subscriptions (monthly/yearly), 14-day trials, one-time lifetime-deal payments, billing portal, scheduled downgrades. <!-- domain_manager/app/controllers/api/checkout_controller.rb:561,644,168; domain_manager/Gemfile:75 -->
- Resend (transactional email), OneSignal (mobile/web push). <!-- domain_manager/config/environments/production.rb:59; domain_manager/app/services/notifications/push_service.rb:3 -->
- Anthropic / OpenAI (AI reports, server-side). <!-- domain_manager/app/services/ai/client.rb:10-27 -->
- Cloudflare for SaaS + Vercel (custom status domains). <!-- domain_manager/app/services/cloudflare_domain_service.rb, vercel_domain_service.rb -->
- MCP (Model Context Protocol) server for AI assistants. <!-- domainpilot-mcp/ -->
- Outbound webhooks: marketing lists "Webhooks to plug into your own automations" and LTD lists "2 Webhooks" — TODO(user): no user-facing outbound-webhook feature was found in routes/models; confirm whether this shipped before claiming it. <!-- domain-pilot-website/components/landing/Features.tsx:57; domain-pilot-website/components/ltd/tierData.ts:53-66 -->

## Platform
- Web app: Next.js SPA at app.domainpilot.io (dashboard, domains, incidents, registrars, settings, billing); marketing site at domainpilot.io. <!-- domain_manager_frontend/src/app/; domain-pilot-website/ -->
- REST API (~165 endpoints) consumed by the frontend; MCP for AI agents. Public API access as a *customer feature* is not documented/marketed — TODO(user): confirm whether "API access" may be claimed. <!-- API_SPECIFICATION.md; CLAUDE.md:255 -->
- Real-time updates via WebSockets (Action Cable). <!-- domain_manager/config/routes.rb:742 -->
- Self-serve signup for Free/Starter/Plus/Pro; Enterprise is contact-sales (self_serve: false). <!-- domain_manager/db/seeds.rb:122-143 -->
- Mobile: a full-featured Flutter app exists in the repo (login/2FA/magic link, dashboard, domains, DNS, incidents, push) but there is NO evidence it has shipped to any app store. Do not claim a mobile app. Backend has hooks for DomainPilot-iOS / DomainPilot-Android user agents. <!-- domainpilot_flutter/lib/; domainpilot_flutter/pubspec.yaml:3-4; domain_manager/app/services/turnstile_service.rb:63-68 -->
- Hosting: Vercel (frontend), Fly.io (Rails + Go + Postgres + Redis), TimescaleDB on Tiger Cloud. Legal entity: Frontcube LLC. <!-- whitepaper.md:36-41; domain-pilot-website/components/layout/Footer.tsx:104 -->

## Explicitly NOT (yet)
<!-- Things people assume we have but we don't. Prevents confident hallucination. -->
- Domain registration/purchase through the app — absent (we don't sell domains). <!-- no register/purchase route in domain_manager/config/routes.rb -->
- Domain transfers through the app — absent (audit constant exists but nothing emits it). <!-- domain_manager/app/services/registrar_audit_service.rb:25 -->
- SMS alerts — stub returning "not yet implemented", despite Pro/Enterprise tier flag and site copy "All notification channels". <!-- domain_manager/app/services/notifications/sms_service.rb:13 -->
- SSO / SAML — absent. Social login (Google/Apple) — absent (Devise modules exclude omniauth; a SOCIAL_LOGIN_IMPLEMENTATION.md plan exists but is unimplemented). <!-- domain_manager/app/models/user.rb:9-10 -->
- On-call rotations / PagerDuty / Opsgenie — absent. <!-- no matches in domain_manager app/, Gemfile -->
- Cron/heartbeat ("dead man's switch") monitoring — absent. <!-- no user-facing model/route -->
- DNS *resolution* checks, TCP/port checks, ICMP ping in monitoring — absent (monitoring is HTTP/HTTPS + SSL only; DNS-change alerts come from registrar-side detection, not resolvers). <!-- uptime-service/internal/checker/ (no DNS/TCP code) -->
- Real User Monitoring (RUM), synthetic transaction monitoring, page-speed diagnostics — absent (publicly conceded on the Pingdom comparison page). <!-- domain-pilot-website/app/pingdom-alternative/page.tsx:894-897 -->
- Azure DNS and Google Cloud DNS — seeded as capabilities but adapter returns "not yet supported". <!-- domain_manager/app/services/dns_provider_adapter.rb:23,105 -->
- Mobile apps in the App Store / Play Store — no evidence of release. <!-- domainpilot_flutter/pubspec.yaml -->
- SLA / uptime guarantee — none offered anywhere. SOC 2 — only "in progress/planned" in the privacy policy; HIPAA/ISO 27001/PCI — never mentioned. <!-- domain-pilot-website/app/privacy/page.tsx:361 -->
- Per-tier data retention — retention is global (pings 7d raw / 90d aggregates), not a plan feature. <!-- domain_manager/db/telemetry_migrate/20260611000001_shrink_pings_retention.rb:34-39 -->

## Caveats — live marketing claims that conflict with code
<!-- The fact-checker should flag copy that repeats these. -->
- "Checks your sites every 1 to 60 minutes" (landing) — wrong; real range is 30 sec – 15 min by plan. <!-- domain-pilot-website/components/landing/Features.tsx:140 vs domain_manager/db/seeds.rb -->
- "Monitoring from 6 regions" (landing/docs/outreach) vs 14 (blog/whitepaper) vs 1 currently running (fly.toml). TODO(user): confirm live count. <!-- uptime-service/fly.toml:18-24 -->
- "5/25/100/500 status pages" — no such limit enforced in code. <!-- domain_manager/db/schema.rb -->
- "All notification channels" (Pro) — SMS is a stub. <!-- domain_manager/app/services/notifications/sms_service.rb:13 -->
- "Webhooks to plug into your own automations" — no outbound-webhook code found. <!-- domain-pilot-website/components/landing/Features.tsx:57 -->
- LTD scarcity numbers disagree: "287 spots remaining" hardcoded vs 37 computed vs "Limited to 300". <!-- domain-pilot-website/components/landing/Pricing.tsx:139; components/ltd/LtdHero.tsx:11,44 -->
- "9 registrars" (site) vs 11 connectable in UI vs 13 in backend. <!-- see Core -->
- "30 to 90 days of uptime history" — raw pings are 7 days; aggregates 90 days. <!-- domain-pilot-website/components/landing/Features.tsx:143 -->
