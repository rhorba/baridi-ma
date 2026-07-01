# DECISIONS — Baridi.ma



## DECISION — 2026-07-01
- Scope: Full new project kickoff (Baridi.ma). Foundation docs required before any code (rule 13).
- Git: initialized locally, remote origin set to https://github.com/rhorba/baridi-ma.git. Push deferred to end of Sprint 1 SHIP phase.
- Env vars: .env.example written with placeholders only, no real secrets collected.
- CMI payments: STUBBED for MVP (YAGNI) — no sandbox credentials yet. Payment-stub interface to be designed by Software Architect; real CMI integration deferred.

## DECISION — 2026-07-01
- Architecture: MICROSERVICES chosen for MVP (comprehensive option). YAGNI concern raised and acknowledged by user; user confirmed intentional choice, reason not tied to a specific stated constraint but explicitly reaffirmed after tradeoff explanation.
- Services (initial split, to be refined in System Design doc): auth, shipment/tracking, ingestion (MQTT/IoT), alerting, compliance/PDF export.

## ARCHITECTURE DECISIONS — 2026-07-01
- ADR-1: Next.js BFF, no separate gateway service.
- ADR-2: Fastify+TS for backend services (not NestJS, not Next.js API routes).
- ADR-3: Synchronous PDF generation, no job queue.
- ADR-4: PaymentProvider port/adapter, StubPaymentProvider for MVP.

## DECISION — 2026-07-01
- Monorepo tooling: npm workspaces (simple, no extra build tool needed at 6-package scale).

## DECISION — 2026-07-01
- Sprint 2: Shipment Service will enforce full defense-in-depth per Security baseline - independent JWT verification (not trusting BFF blindly) + x-internal-token check + per-resource ownership checks (shipperId/carrierId/receiverId).

## DECISION — 2026-07-01
- Sprint 3: MQTT device auth is app-layer (deviceToken field in payload, validated against shipment.devices), not broker-level ACLs. Mosquitto stays anonymous. Reason: matches Security baseline per-device-credential requirement without MQTT ACL file management overhead at pilot scale.
- Gap found while planning: no endpoint exists to create/assign a device to a shipment (shipment.devices + shipments.assigned_device_id exist in schema but unused since Sprint 2). Will auto-provision one device per shipment at creation time in Shipment Service, returning deviceToken in the create-shipment response so a simulator/sensor can be configured with it. Keeps scope to what Stories 3.1-3.4 need without building a separate device-management flow.
- Alerting Service fetches shipment thresholds via a new Shipment Service internal endpoint (GET /internal/shipments/:id, internal-token only, no JWT/ownership check since it is service-to-service) rather than direct cross-schema DB access, per architecture doc's stated design ("fetched from Shipment DB via internal API").
- Alert dedup: skip creating a new alert if one already exists for the same shipment+reason within the last 5 minutes (basic debounce for burst readings, per Test Strategy adversarial checklist).
- Email sending: nodemailer wired for real SMTP via env vars if provided, falls back to a no-op/logging transport when unset (no real SMTP credentials available for MVP) - same pattern as the CMI payment stub.

## DECISION — 2026-07-01
- CI pipeline scope: full 6-stage pipeline (lint, test w/ 80% coverage gate, security-scan, build, deploy-staging, deploy-prod) per docs/devops-baridi-ma.md, deployed to this local machine acting as the "VPS" instead of provisioning a cloud server.
- Deploy mechanism: register this machine as a GitHub Actions self-hosted runner. deploy-staging runs automatically on every push to main (git pull + docker compose up -d --build + migrate). deploy-prod requires a GitHub Environment manual-approval gate, triggered on version tags, also runs on the same self-hosted runner (pilot scale = one box for both per docs/devops-baridi-ma.md §3).
- Accepted risk (flagged to user before deciding): self-hosted runners execute workflow-defined code with the host machine's permissions. Acceptable here only because this is a private, solo-maintainer repo with no untrusted external PRs.
