# Security Baseline: Baridi.ma
**Architecture Reference**: docs/architecture-baridi-ma.md
**Version**: 1.0 | **Date**: 2026-07-01 | **Author**: Security Engineer

## 1. Threat Model (5-Minute)
- **What are we building?** A cold-chain tracking platform handling shipment data, IoT sensor telemetry, and compliance-critical PDFs used as legal evidence for EU customs.
- **Who would attack it?** Competitors (data theft/sabotage), disgruntled carriers (falsifying sensor data to hide a cold-chain breach), opportunistic attackers (credential stuffing, since accounts gate business-critical data)
- **Worst outcome?** A carrier or attacker tampers with sensor readings or a compliance PDF to hide a real temperature excursion — false compliance record reaches EU customs. Secondary: account takeover exposing shipper/receiver business data.

## 2. STRIDE Analysis (top risks only)
| Threat | Component | Mitigation | Status |
|---|---|---|---|
| Spoofing | Sensor ingestion (MQTT) | Per-device credential (unique token per device), reject unrecognized device IDs | TODO |
| Tampering | Sensor readings / Compliance PDF | Readings are append-only (no UPDATE/DELETE API); PDF includes SHA-256 hash of the underlying reading set, stored alongside the export record | TODO |
| Repudiation | Shipment status changes | Every status change logged with actor user ID + timestamp (audit trail table) | TODO |
| Info Disclosure | Cross-tenant data access | Resource-ownership check at each service (a Shipper can't read another Shipper's shipment) | TODO |
| DoS | MQTT ingestion endpoint | Rate-limit per device ID at Ingestion Service; broker-level connection limits | TODO |
| Elevation of Privilege | Role checks at BFF vs service | Role AND ownership checked at the service layer too, not just BFF (defense in depth — BFF check alone is insufficient if internal token is compromised) | TODO |

## 3. Authentication Strategy
- **Type**: JWT, issued by Auth Service, short-lived access token (15min) + refresh token (7 days, httpOnly cookie)
- **MFA**: Not required for MVP — justified by pilot-scale user count and no payment data in scope yet; revisit before real CMI integration goes live
- **Password policy**: Minimum 10 characters, checked against a common-password blocklist (not full breach-list API for MVP — YAGNI, revisit if account takeover becomes a real incident)
- **Session management**: Refresh token httpOnly + Secure + SameSite=Strict cookie; access token in memory on client, never localStorage

## 4. Authorization Model
- **Pattern**: Simple RBAC (4 roles: Shipper, Carrier, Receiver, Admin) + resource-ownership checks
- **Roles defined**: Shipper (creates/owns shipments), Carrier (assigned to shipments, updates status), Receiver (views delivered shipments, exports compliance), Admin (full access, user management)
- **Resource-level checks**: Yes — per-object. A Shipment record's `shipperId`/`carrierId`/`receiverId` fields are checked against the requesting user on every read/write, not just role.

## 5. Data Protection
- **PII fields**: User email, name, phone (Auth DB); shipment origin/destination addresses (Shipment DB — business-sensitive, not classic PII but treated with same care)
- **Encryption at rest**: Postgres/TimescaleDB volume encryption at the OS/disk level (standard for MVP hosting); no column-level encryption needed yet — no highly sensitive fields (no payment data stored, since payments are stubbed)
- **Encryption in transit**: HTTPS enforced everywhere (BFF↔client, and internal service calls over the Docker network use TLS if crossing untrusted network boundaries; same-host Docker network is acceptable unencrypted for MVP)
- **Secrets management**: Env vars for MVP (`.env.local`, never committed — see `.env.example`), upgrade to a secrets manager (e.g. Doppler/Vault) before production launch with real users

## 6. Security Requirements for Dev Team
- [ ] All inputs validated server-side (each Fastify service uses schema validation, e.g. Zod/JSON Schema, on every route)
- [ ] Output encoded for context — React/Next.js auto-escapes by default; no `dangerouslySetInnerHTML` without explicit sanitization
- [ ] No secrets in code, logs, or error messages — error responses never leak stack traces or internal DB errors to the client
- [ ] HTTPS only in any non-local environment; security headers (HSTS, X-Content-Type-Options, X-Frame-Options) set at the BFF
- [ ] Dependencies scanned in CI (SCA) — Trivy/npm audit as part of DevOps pipeline (see DevOps doc)
- [ ] Sensor ingestion endpoint validates device token before writing any data — no anonymous writes to TimescaleDB

## 7. Note on Internal Service-to-Service Trust (flagged from Architecture doc)
MVP uses a shared-secret internal token for service-to-service calls, not mTLS. Acceptable at this scale (single-host Docker Compose, small trusted network) but should be revisited before a multi-host or public-cloud production deployment.
