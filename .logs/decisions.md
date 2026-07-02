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

## DECISION — 2026-07-01
- Sprint 4 re-export behavior: idempotent - if compliance.exports already has a row for a shipment, return the existing export instead of regenerating (matches the UNIQUE constraint literally; shipments are only exportable once delivered/terminal, so readings can't change post-export anyway).
- Architecture: Compliance Service gets its own internal-auth pattern (new GET /internal/shipments/:id on Shipment Service, x-internal-token guarded) rather than direct cross-schema SQL, consistent with every other service-to-service call in this codebase. Compliance Service does its own ownership check (Receiver must own the shipment as receiver, or Admin bypass) using the real end-user JWT, mirroring findShipmentForViewer's defense-in-depth pattern.
- POST /compliance/:shipmentId/export both generates (or reuses) and returns the PDF synchronously in one call (ADR-3), no separate generate+download round trip.
## PLAN_APPROVED — 2026-07-02
- User confirmed Batch 1 (Compliance Service backend, Story 4.1) go-ahead. Proceeding to EXECUTE phase.

## UNDERSTAND — Sprint 5 (Epic 5: Admin Panel) — 2026-07-02
- Scope: Story 5.1 (admin list/deactivate users, FR-6, Backend+Frontend, size M) and Story 5.2 (admin shipment oversight, Frontend only, size S), per docs/stories-baridi-ma.md.
- Existing groundwork found: auth.users already has an is_active column; login and /auth/me already reject inactive users; GET /shipments already returns ALL shipments for role=admin (Story 5.2's backend need is already met).
- Real gap found during review: POST /auth/refresh does NOT check is_active before minting a new access token — a deactivated user's still-valid refresh token (7-day TTL) would keep working via refresh indefinitely, undermining "deactivate". This needs a fix as part of 5.1, not just new list/deactivate endpoints.

## BRAINSTORM — Sprint 5 — 2026-07-02
- 5.1: list + deactivate only (no reactivate), matches FR-6 literally. Admin cannot deactivate their own account (lockout guard).
- 5.1 gap fix: /auth/refresh will check is_active before minting a new access token.
- 5.2: Shipment Service batch-resolves shipper/carrier/receiver emails via a new internal Auth Service endpoint, attached to each shipment only for role=admin responses; shipments list page shows them for admin.

## PLAN_APPROVED — 2026-07-02
- User confirmed Sprint 5 Batch 1 (backend: admin user list/deactivate, refresh is_active fix, batched owner-email resolution) go-ahead. Proceeding to EXECUTE phase.

## UNDERSTAND/BRAINSTORM — Post-MVP: S3 storage + persistent runner — 2026-07-02
- New scope beyond the planned 5-sprint backlog, requested directly by user. Architecture doc already anticipated this ("S3 (post-MVP)").
- S3: MinIO added to docker-compose as a local S3-compatible emulator (no real AWS account needed for dev); Compliance Service uses the AWS S3 SDK, which works identically against real AWS S3 in any other environment via env vars only.
- Data: clean cutover — compliance.exports.file_path renamed to storage_key and existing dev-only rows truncated (pre-launch, no real data to preserve).
- Runner: install the existing self-hosted runner as a Windows service (manual start, not auto-boot-start) so it survives terminal closes without needing to remember `run.cmd` each time.

## PLAN_APPROVED — 2026-07-02
- User confirmed S3/MinIO storage migration Batch 1 go-ahead. Proceeding to EXECUTE phase.
