# PRD: Baridi.ma — Cold-Chain Logistics Tracker
**Version**: 1.0 | **Date**: 2026-07-01 | **Author**: PM | **Status**: Draft

## 1. Problem Statement
Morocco exports ~3B MAD of perishables annually, but temperature-sensitive shipments (pharma, dairy, agri) are tracked on paper. Pharma distributors, dairy cooperatives, and agri-exporters lose product quality and fail EU customs compliance checks because there's no verifiable, real-time record of cold-chain integrity.

## 2. Goals & Success Metrics
| Goal | Metric | Target (MVP) |
|---|---|---|
| Prove real-time tracking works | Shipments with a live sensor feed | 10 pilot shipments |
| Prove compliance value | Compliance PDF exports generated | 1 per completed shipment |
| Prove alerting works | Temperature-excursion alert latency | < 60s from sensor reading to alert |

## 3. User Stories
- As a **Shipper**, I want to create a shipment and assign a carrier, so that I have a record of what's in transit.
- As a **Carrier**, I want to see assigned shipments and their sensor status, so that I can respond to excursions in transit.
- As a **Receiver**, I want to view a shipment's full temperature history on delivery, so that I can verify product integrity before accepting.
- As an **Admin**, I want to see all shipments and manage users/carriers, so that I can operate the platform.
- As any authenticated role, I want to export a tamper-evident compliance PDF for a completed shipment, so that I can submit it to EU customs.

## 4. Scope

### In Scope (MVP)
- Auth + 4 roles (Shipper, Carrier, Receiver, Admin) with role-based access
- Shipment CRUD (create, assign carrier, track status: created → in-transit → delivered)
- MQTT ingestion of temperature/humidity readings from IoT sensors, tied to a shipment
- Live shipment view (current temp/humidity, status, basic map/route placeholder)
- Threshold-based alerting (temp/humidity excursion → in-app + email alert)
- Tamper-evident compliance PDF export (sensor history + signature/hash) per completed shipment
- Admin panel: user/carrier management, shipment oversight

### Out of Scope (MVP — deferred)
- Real CMI payment integration (stubbed per [[decision]] — see decisions log)
- Live GPS fleet map / route optimization (track.ma-style features)
- Multi-language i18n beyond French/Arabic labels
- Native mobile apps (web-responsive only for MVP)
- Automated carrier marketplace / bidding (Wassalha-style COD matching)

## 5. Requirements

### Functional
- FR-1: Users register/login with email+password, assigned one role
- FR-2: Shipper creates a shipment (origin, destination, product type, temp thresholds)
- FR-3: System ingests MQTT sensor readings and associates them with a shipment via device ID
- FR-4: System evaluates each reading against shipment thresholds and fires an alert on breach
- FR-5: Receiver/Admin can generate a compliance PDF for a delivered shipment
- FR-6: Admin can list/deactivate users and carriers

### Non-Functional
- NFR-1: Performance — sensor reading ingestion-to-alert < 60s (p99)
- NFR-2: Security — role-based access control on all endpoints; sensor data integrity (no silent tampering)
- NFR-3: Accessibility — WCAG AA for core flows (shipment creation, tracking view)
- NFR-4: Data retention — sensor readings retained ≥ 2 years (EU customs audit window)

## 6. Constraints & Assumptions
- No real IoT hardware yet — MVP uses a simulated MQTT publisher for sensor data
- No CMI merchant account yet — payments stubbed behind an interface
- Single-region deployment (Morocco/EU latency acceptable), no multi-region HA for MVP
- User confirmed microservices architecture despite YAGNI recommendation of a monolith (see [[decision]] log, 2026-07-01)

## 7. Risks
| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Microservices overhead slows MVP delivery | H | M | Keep service boundaries minimal (5 services), shared Docker Compose for local dev, revisit split post-MVP if it hurts velocity |
| No real sensor hardware to validate ingestion | M | M | Build a simulated MQTT publisher as part of DevOps tooling |
| EU compliance PDF format requirements unclear | M | H | Ship a basic tamper-evident PDF (hash + timestamp) for MVP; validate format with a real customs contact before GA |
| CMI integration deferred creates rework later | L | M | Design payment as an interface/port from day one so stub → real swap is isolated |

## 8. Timeline
| Milestone | Target |
|---|---|
| PRD Approved | 2026-07-01 |
| Foundation docs approved | 2026-07-01 |
| Sprint 1 (auth + shipment CRUD) | TBD in stories doc |
| MVP Ready | TBD in stories doc |
