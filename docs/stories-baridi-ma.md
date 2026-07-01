# Stories: Baridi.ma
**PRD**: docs/prd-baridi-ma.md
**Architecture**: docs/architecture-baridi-ma.md
**Test Strategy**: docs/test-strategy-baridi-ma.md

## Epic 1: Foundation & Auth
Scaffolds the monorepo, Docker Compose, and authentication — everything else depends on this.

### Story 1.1: Monorepo + Docker Compose scaffold
**Priority**: Must | **Size**: M | **Specialist**: DevOps/DevSecOps
As a developer, I want a working `docker-compose up` with all 6 services + Postgres/TimescaleDB + Mosquitto, so that local dev works end-to-end from day one.
**Acceptance Criteria**: `docker-compose up` starts all containers; Postgres has TimescaleDB extension enabled; health-check endpoint on each service returns 200.
**Technical Notes**: Per DevOps doc Docker setup. Includes migration runner for `001`-`005` schema files.

### Story 1.2: Auth Service — register/login/JWT
**Priority**: Must | **Size**: M | **Specialist**: Backend Dev
As a user, I want to register and log in, so that I get a JWT identifying my role.
**Acceptance Criteria** (Gherkin, from Test Strategy):
```gherkin
Scenario: User registers and logs in
  Given a valid email, password, and role
  When the user registers
  Then a user record is created and login issues a JWT
Scenario: Unauthenticated request rejected
  Given no JWT
  When a protected endpoint is called
  Then the response is 401
```
**Technical Notes**: FR-1. Uses `auth.users` schema (Database doc). bcrypt/argon2 password hashing (Security doc).
**Dependencies**: 1.1

### Story 1.3: BFF auth middleware + role forwarding
**Priority**: Must | **Size**: S | **Specialist**: Backend Dev
As the system, I want the Next.js BFF to validate JWTs and forward identity to internal services, so that internal services can enforce ownership checks.
**Technical Notes**: ADR-1 (architecture doc). Internal shared-secret token per Security doc §7.
**Dependencies**: 1.2

---

## Epic 2: Shipment Management
### Story 2.1: Shipment CRUD (Shipper creates, views own)
**Priority**: Must | **Size**: M | **Specialist**: Backend Dev
As a Shipper, I want to create a shipment with thresholds, so that I have a trackable record.
**Acceptance Criteria**:
```gherkin
Scenario: Shipper creates a shipment
  Given a logged-in Shipper
  When they submit valid shipment details with temp thresholds
  Then a shipment is created with status "created"
Scenario: Non-owner cannot modify a shipment
  Given a Shipper who does not own shipment X
  When they attempt to update shipment X
  Then the response is 403
```
**Technical Notes**: FR-2. `shipment.shipments` table (Database doc). Ownership check per Security doc §4.
**Dependencies**: 1.3

### Story 2.2: Carrier assignment + status transitions
**Priority**: Must | **Size**: S | **Specialist**: Backend Dev
As a Shipper, I want to assign a carrier; as a Carrier, I want to update shipment status, so that the shipment lifecycle reflects reality.
**Technical Notes**: `status` enum transitions: created→in_transit→delivered/cancelled. Writes to `shipment.audit_log`.
**Dependencies**: 2.1

### Story 2.3: Shipment list + detail UI (all roles)
**Priority**: Must | **Size**: M | **Specialist**: Frontend Dev
As any role, I want to see my scoped shipment list and a detail view, so that I can track shipments.
**Technical Notes**: UX doc Flow 1, UI doc shipment-detail wireframe. Role-scoped queries (idx_shipments_shipper/carrier/receiver).
**Dependencies**: 2.2

---

## Epic 3: Sensor Ingestion & Alerting
### Story 3.1: Ingestion Service — MQTT subscriber + TimescaleDB writer
**Priority**: Must | **Size**: L | **Specialist**: Backend Dev
As the system, I want to ingest sensor readings via MQTT and store them, so that shipment temperature history exists.
**Acceptance Criteria**:
```gherkin
Scenario: Valid device publishes a reading
  Given a registered device with a valid token, assigned to a shipment
  When it publishes a temperature reading via MQTT
  Then the reading is stored in sensor_readings within 5s
Scenario: Unregistered device is rejected
  Given an unknown device token
  When it attempts to publish
  Then the reading is discarded and not written to the database
```
**Technical Notes**: FR-3. Append-only enforced via revoked grants (Database doc). Adversarial: malformed payload, replay, token reuse (Test Strategy §4).
**Dependencies**: 1.1

### Story 3.2: Sensor simulator (dev/test tool)
**Priority**: Must | **Size**: S | **Specialist**: DevOps/DevSecOps
As a developer, I want a simulated MQTT publisher, so that I can test ingestion/alerting without real hardware.
**Technical Notes**: Per PRD constraint (no hardware yet) and DevOps doc.
**Dependencies**: 3.1

### Story 3.3: Alerting Service — threshold evaluation
**Priority**: Must | **Size**: M | **Specialist**: Backend Dev
As the system, I want to evaluate each reading against shipment thresholds and fire alerts, so that excursions are caught within 60s.
**Acceptance Criteria**:
```gherkin
Scenario: Reading breaches threshold
  Given a shipment with temp_max_c = 8.0
  When a reading of 8.6°C is ingested
  Then an alert is created within 60s and an email is sent
Scenario: Reading within threshold
  Given a shipment with temp_max_c = 8.0
  When a reading of 4.2°C is ingested
  Then no alert is created
```
**Technical Notes**: FR-4. Postgres LISTEN/NOTIFY from Ingestion (SDR-2). Adversarial: duplicate alerts on burst readings (Test Strategy §4).
**Dependencies**: 3.1

### Story 3.4: Live tracking chart + alert UI
**Priority**: Must | **Size**: M | **Specialist**: Frontend Dev
As a Carrier/Shipper/Receiver, I want to see live temp/humidity and alerts on the shipment detail screen, so that I have visibility.
**Technical Notes**: UX Flow 2, UI doc Recharts component + status badge.
**Dependencies**: 3.3, 2.3

---

## Epic 4: Compliance Export
### Story 4.1: Compliance Service — PDF generation + hash
**Priority**: Must | **Size**: M | **Specialist**: Backend Dev
As a Receiver, I want to export a tamper-evident compliance PDF, so that I can submit it to EU customs.
**Acceptance Criteria**:
```gherkin
Scenario: Receiver exports compliance PDF for delivered shipment
  Given a shipment with status "delivered" and a reading history
  When the Receiver requests a compliance export
  Then a PDF is generated containing the full reading history and a SHA-256 hash
Scenario: Cannot export for non-delivered shipment
  Given a shipment with status "in_transit"
  When a compliance export is requested
  Then the response is 400
```
**Technical Notes**: FR-5. ADR-3 (synchronous generation). `compliance.exports` table.
**Dependencies**: 3.1, 2.2

### Story 4.2: Compliance export UI
**Priority**: Must | **Size**: S | **Specialist**: Frontend Dev
As a Receiver, I want an "Export Compliance PDF" button on delivered shipments, so that I can download the record.
**Dependencies**: 4.1, 3.4

---

## Epic 5: Admin Panel
### Story 5.1: Admin user/carrier management
**Priority**: Should | **Size**: M | **Specialist**: Backend Dev + Frontend Dev
As an Admin, I want to list/deactivate users, so that I can operate the platform.
**Technical Notes**: FR-6.
**Dependencies**: 1.3

### Story 5.2: Admin shipment oversight
**Priority**: Should | **Size**: S | **Specialist**: Frontend Dev
As an Admin, I want to see all shipments across the platform, so that I can provide support/oversight.
**Dependencies**: 2.3

---

## Sprint Allocation
| Sprint | Stories | Estimated Effort |
|---|---|---|
| Sprint 1 | 1.1, 1.2, 1.3 | Foundation — infra + auth working end-to-end |
| Sprint 2 | 2.1, 2.2, 2.3 | Shipment management usable by all roles |
| Sprint 3 | 3.1, 3.2, 3.3, 3.4 | Ingestion + alerting — the core cold-chain value prop |
| Sprint 4 | 4.1, 4.2 | Compliance export — the EU customs value prop |
| Sprint 5 | 5.1, 5.2 | Admin panel + polish, then release-gate checks (80% coverage, security scan, E2E video) |
