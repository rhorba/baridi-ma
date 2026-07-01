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
