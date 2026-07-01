# Architecture: Baridi.ma
**PRD Reference**: docs/prd-baridi-ma.md
**System Design Reference**: docs/system-design-baridi-ma.md
**Version**: 1.0 | **Date**: 2026-07-01 | **Author**: Software Architect

## 1. Overview
Five independently deployable Node/TypeScript services behind a Next.js BFF (web client + API gateway). Each service owns its data and exposes an internal REST API. Docker Compose orchestrates all services + Postgres/TimescaleDB + MQTT broker for local dev.

## 2. Architecture Decision Records

### ADR-1: Next.js web app acts as the API Gateway / BFF
- **Context**: Client needs one entry point; we don't want a separate gateway service (Kong/Traefik) for MVP scale
- **Decision**: Next.js API routes proxy/aggregate calls to internal services. Auth (session/JWT check) happens here before forwarding.
- **Alternatives**: Dedicated API gateway service (rejected — YAGNI, adds an operational component with no current need)
- **Consequences**: Web app has a light coupling to internal service URLs (via env vars/service discovery), but stays deployable as one Next.js app for the frontend concern

### ADR-2: Each backend service is a minimal Node.js (Express or Fastify) + TypeScript service
- **Context**: Need a consistent, lightweight pattern across 5 services without reinventing Next.js's app router for non-UI services
- **Decision**: Fastify + TypeScript for Auth, Shipment, Ingestion, Alerting, Compliance services. Shared `packages/shared-types` for cross-service DTOs (TS project references or a small internal npm package).
- **Alternatives**: NestJS (rejected — heavier framework than needed for 5 small services); each service in Next.js API routes (rejected — conflates BFF and backend service concerns)
- **Consequences**: One more toolchain (Fastify) alongside Next.js, but keeps services small and independently testable

### ADR-3: Compliance PDF is generated synchronously via Compliance Service, not a background job queue
- **Context**: PDF generation for a single completed shipment is fast (< 2s) and infrequent (per-shipment, not per-reading)
- **Decision**: Compliance Service exposes `POST /compliance/:shipmentId/export` that generates and returns the PDF synchronously (pdf-lib or Puppeteer)
- **Alternatives**: Background job queue (BullMQ) + polling (rejected — YAGNI, no volume justifies async processing yet)
- **Consequences**: Simpler to build and test; revisit if export volume or generation time grows

### ADR-4: Payment integration is a Port/Adapter interface, stub adapter for MVP
- **Context**: CMI credentials not available; payments out of scope for MVP but architecture shouldn't block future integration
- **Decision**: Define a `PaymentProvider` interface (`charge()`, `refund()`, `getStatus()`) in shared-types. MVP ships a `StubPaymentProvider` that always succeeds. No payment service deployed yet — logic lives as a stub module inside Shipment Service until real integration is needed.
- **Alternatives**: Build a full Payment Service now (rejected — no credentials, no requirement yet — YAGNI)
- **Consequences**: Swapping in real CMI later means implementing one adapter class, not restructuring the system

## 3. System Design
```
[Next.js BFF] → [Auth Service] → [Auth DB]
             → [Shipment Service] → [Shipment DB] → (StubPaymentProvider, in-process)
             → [Alerting Service] → [Alert DB]
             → [Compliance Service] → reads [Shipment DB] + [TimescaleDB], writes signed PDF to local volume (MVP) / S3 (post-MVP)
[Ingestion Service] ← MQTT ← [Sensors/Simulator]
             → writes [TimescaleDB]
             → NOTIFY 'reading_ingested' → [Alerting Service] LISTENs, evaluates thresholds (fetched from Shipment DB via internal API)
```

## 4. Data Model (summary — full schema in DBA doc)
```
User ──1:N──> Shipment (as shipper)
User ──1:N──> Shipment (as carrier, nullable until assigned)
User ──1:N──> Shipment (as receiver)
Shipment ──1:1──> Device (assigned sensor for this shipment)
Device ──1:N──> SensorReading (TimescaleDB hypertable, high volume)
Shipment ──1:N──> Alert (fired on threshold breach)
Shipment ──0:1──> ComplianceExport (generated once, on delivery)
```

## 5. API Design (per service, representative — full contracts owned by each service)

**Auth Service**
| Method | Endpoint | Description | Auth |
|---|---|---|---|
| POST | /auth/register | Create user with role | Public |
| POST | /auth/login | Issue JWT | Public |
| GET | /auth/me | Current user info | Required |

**Shipment Service**
| Method | Endpoint | Description | Auth |
|---|---|---|---|
| POST | /shipments | Create shipment | Shipper |
| GET | /shipments | List (scoped by role) | Required |
| GET | /shipments/:id | Get one (with live status) | Required, owner/assigned |
| PATCH | /shipments/:id/assign-carrier | Assign carrier | Shipper/Admin |
| PATCH | /shipments/:id/status | Update status | Carrier/Admin |

**Ingestion Service**
| Method | Endpoint | Description | Auth |
|---|---|---|---|
| (MQTT topic) | `sensors/{deviceId}/readings` | Sensor publishes reading | Device credential |
| GET | /ingestion/devices/:id/readings | Query history (used by Compliance) | Internal |

**Alerting Service**
| Method | Endpoint | Description | Auth |
|---|---|---|---|
| GET | /alerts?shipmentId= | List alerts for a shipment | Required |

**Compliance Service**
| Method | Endpoint | Description | Auth |
|---|---|---|---|
| POST | /compliance/:shipmentId/export | Generate signed PDF | Receiver/Admin |

## 6. Security Considerations
[Full detail in Security Baseline doc — summary here]
- Authentication: JWT issued by Auth Service, validated by BFF and each internal service
- Authorization: Role check at BFF (coarse) + resource-ownership check at service level (fine)
- Data protection: Sensor reading integrity via device credentials (per-device token, not shared secret); compliance PDFs hashed for tamper evidence
- Key risks: internal service-to-service calls need to trust the BFF's forwarded identity — mitigated with a short-lived internal service token

## 7. Infrastructure
- Hosting: single VPS/small cloud instance for MVP (Docker Compose), no orchestrator (K8s) — YAGNI at pilot scale
- Database: PostgreSQL 16 + TimescaleDB extension, one instance, per-service schemas
- CI/CD: GitHub Actions (lint, test, build, deploy) — detailed in DevOps doc
- Monitoring: stdout structured logs via Docker log driver for MVP; upgrade to a real log aggregator post-MVP

## 8. Technical Risks
| Risk | Mitigation | Owner |
|---|---|---|
| 5 services increase local dev friction | Single `docker-compose up` spins up everything; shared-types package keeps contracts in sync | Tech Lead |
| Service-to-service auth adds complexity | Simple internal shared-secret token for MVP (not full mTLS) — documented in Security doc | Security Engineer |
| Postgres LISTEN/NOTIFY reliability at scale | Acceptable at 50 msg/sec target; re-evaluate with a real queue if volume grows | System Designer |
