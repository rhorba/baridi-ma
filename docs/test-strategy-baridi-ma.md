# Test Strategy: Baridi.ma
**PRD Reference**: docs/prd-baridi-ma.md
**Architecture Reference**: docs/architecture-baridi-ma.md
**Version**: 1.0 | **Date**: 2026-07-01 | **Author**: Test Architect

## 1. Risk Assessment
| Component | Impact | Frequency | Complexity | Test Level |
|---|---|---|---|---|
| Ingestion Service (MQTT → TimescaleDB) | H | H | M | Maximum |
| Alerting Service (threshold evaluation) | H | M | M | Maximum |
| Auth Service (JWT, RBAC) | H | H | L | High |
| Shipment Service (CRUD, ownership checks) | H | H | M | High |
| Compliance Service (PDF + hash) | H | L | M | High |
| BFF (Next.js routing/proxy) | M | H | L | Standard |
| Admin panel | M | L | L | Standard |

## 2. Test Pyramid Targets
| Layer | Coverage Target | Tooling |
|---|---|---|
| Unit | ≥ 60% of business logic | Vitest (per service) |
| Integration | ≥ 40% of API + DB layer | Supertest + Testcontainers (real Postgres/TimescaleDB in CI) |
| E2E | Critical happy paths only | Playwright |
| **Combined gate** | **≥ 80%** — non-negotiable per CLAUDE.md rule 6 | CI blocks merge if below |

## 3. ATDD Acceptance Scenarios (critical paths, mapped to PRD FRs)

```gherkin
Feature: Auth (FR-1)

  Scenario: User registers and logs in
    Given a valid email, password, and role
    When the user registers
    Then a user record is created and login issues a JWT

  Scenario: Unauthenticated request rejected
    Given no JWT
    When a protected endpoint is called
    Then the response is 401

Feature: Shipment creation and assignment (FR-2)

  Scenario: Shipper creates a shipment
    Given a logged-in Shipper
    When they submit valid shipment details with temp thresholds
    Then a shipment is created with status "created"

  Scenario: Non-owner cannot modify a shipment
    Given a Shipper who does not own shipment X
    When they attempt to update shipment X
    Then the response is 403

Feature: Sensor ingestion (FR-3)

  Scenario: Valid device publishes a reading
    Given a registered device with a valid token, assigned to a shipment
    When it publishes a temperature reading via MQTT
    Then the reading is stored in sensor_readings within 5s

  Scenario: Unregistered device is rejected
    Given an unknown device token
    When it attempts to publish
    Then the reading is discarded and not written to the database

Feature: Threshold alerting (FR-4)

  Scenario: Reading breaches threshold
    Given a shipment with temp_max_c = 8.0
    When a reading of 8.6°C is ingested
    Then an alert is created within 60s and an email is sent

  Scenario: Reading within threshold
    Given a shipment with temp_max_c = 8.0
    When a reading of 4.2°C is ingested
    Then no alert is created

Feature: Compliance export (FR-5)

  Scenario: Receiver exports compliance PDF for delivered shipment
    Given a shipment with status "delivered" and a reading history
    When the Receiver requests a compliance export
    Then a PDF is generated containing the full reading history and a SHA-256 hash

  Scenario: Cannot export for non-delivered shipment
    Given a shipment with status "in_transit"
    When a compliance export is requested
    Then the response is 400
```

## 4. Adversarial Checklist (high-risk components only)

**Ingestion Service**
- [ ] Malformed MQTT payload (missing fields, wrong types) does not crash the service or corrupt data
- [ ] Replayed/duplicate readings (same device_id + time) handled idempotently
- [ ] Device token reused across two different devices — rejected/flagged

**Alerting Service**
- [ ] Rapid burst of breach readings does not create duplicate alerts for the same excursion window
- [ ] Threshold evaluation race: reading arrives before shipment's threshold update — verify no stale-threshold false negative

**Auth / Shipment Service**
- [ ] Privilege escalation: Carrier attempts to call Shipper-only or Admin-only endpoints
- [ ] IDOR: authenticated user requests a shipment ID they don't own — must 403, not leak existence via 404 vs 403 timing difference
- [ ] JWT tampering (modified role claim) rejected by signature verification

**Compliance Service**
- [ ] PDF hash verification: altering a single reading after export invalidates the original hash (proves tamper-evidence works)

## 5. Release Gate Criteria
- [ ] All acceptance scenarios above pass
- [ ] Combined unit + integration coverage ≥ 80% (CI-enforced, per CLAUDE.md rule 6)
- [ ] No critical/high security findings open (Trivy/Semgrep/Gitleaks clean — see DevOps doc)
- [ ] E2E happy path (Shipper creates → Carrier transports → alert fires → Receiver exports) passes, recorded per CLAUDE.md rule 9 at version completion
