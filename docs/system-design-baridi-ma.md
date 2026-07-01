# System Design: Baridi.ma
**PRD Reference**: docs/prd-baridi-ma.md
**Version**: 1.0 | **Date**: 2026-07-01 | **Author**: System Designer

## 1. Non-Functional Requirements
| Attribute | Target | Notes |
|---|---|---|
| Availability | 99% (MVP, single region) | No multi-region HA until real traffic proves need |
| Latency (p99, API) | 300ms | Standard CRUD/read paths |
| Latency (p99, sensor→alert) | 60s | Per PRD NFR-1 |
| Throughput | 50 sensor msgs/sec | Sized for 10-50 pilot shipments, generous headroom |
| Data Volume | < 1 GB/day | Sensor time-series at 1 reading/min/device |
| Retention | ≥ 2 years (sensor data) | EU customs audit requirement |
| Recovery (RTO) | 4h | Acceptable for pilot phase |
| Recovery (RPO) | 15min | TimescaleDB continuous backup |

## 2. Component Topology

```
[Web Client (Next.js)] ──HTTPS──> [API Gateway (Next.js API routes / BFF)]
                                          │
        ┌─────────────────┬──────────────┼──────────────┬──────────────────┐
        ▼                 ▼              ▼               ▼                 ▼
  [Auth Service]   [Shipment Service] [Alerting Service] [Compliance/PDF   [Admin ops routed
  (users, roles,   (CRUD, status,     (evaluates          Service]          through Shipment +
   JWT issuing)     carrier assign)    thresholds,        (generates        Auth services)
        │                 │            sends alerts)      tamper-evident
        ▼                 ▼                 ▲              PDF from
   [Auth DB           [Shipment DB      [Alert DB          Shipment DB
    (Postgres)]        (Postgres)]       (Postgres)]        + hash/sign)
                             ▲                │
                             │                │
                    [Ingestion Service] ──publishes──> (internal event: reading.ingested)
                             ▲
                             │ MQTT
                    [IoT Sensors / Simulated Publisher]
                             │
                    [MQTT Broker (Mosquitto, Dockerized)]
                             ▼
                  [TimescaleDB — sensor_readings hypertable]

  [Observability: structured logs → stdout → (Docker log driver for MVP)]
```

## 3. Integration Patterns
| Integration | Pattern | Reason |
|---|---|---|
| Web client ↔ API Gateway | REST (Next.js API routes) | Simple, matches Next.js monolith-as-BFF; no need for GraphQL at this scale |
| API Gateway ↔ internal services | REST (internal HTTP, Docker network) | Simplest inter-service call for MVP traffic volume; avoids gRPC/queue complexity |
| Sensors ↔ Ingestion Service | MQTT (pub/sub) | Standard IoT protocol, lightweight for constrained devices |
| Ingestion → Alerting | Internal event (HTTP callback or lightweight pub/sub via Postgres LISTEN/NOTIFY) | Avoids introducing a message broker (Kafka/RabbitMQ) just for one internal signal — YAGNI |
| Alerting → user | Email (transactional) + in-app (poll or SSE) | No push infra needed for MVP; SSE/poll is enough at pilot scale |

## 4. Scalability Strategy
- Scaling approach: vertical for MVP (single Docker host or small VM per service); horizontal only if a specific service proves to be a bottleneck
- Cache strategy: none for MVP — no proven read-heavy hot path yet
- Queue strategy: none beyond MQTT broker (already required for IoT) — Postgres LISTEN/NOTIFY covers the one internal event, no Kafka/RabbitMQ

## 5. System Design Decision Records

### SDR-1: Five services, not more, not a monolith
- **NFR Driver**: User-mandated microservices architecture (see decisions log 2026-07-01)
- **Decision**: Split into Auth, Shipment/Tracking, Ingestion, Alerting, Compliance/PDF — the minimum split that maps to the PRD's distinct bounded contexts. No separate services for things like "notifications" or "reporting" until a real need appears.
- **Alternatives**: Monolith (rejected — user's explicit choice); >5 services e.g. splitting admin into its own service (rejected — no distinct scaling/ownership need)
- **Re-evaluate when**: A specific service shows a scaling or team-ownership need the others don't

### SDR-2: No message broker beyond MQTT
- **NFR Driver**: Throughput target is 50 msgs/sec — far below what justifies Kafka/RabbitMQ operational cost
- **Decision**: Use Postgres LISTEN/NOTIFY (or a direct internal HTTP call) for Ingestion→Alerting signaling
- **Alternatives**: Kafka/RabbitMQ (rejected — YAGNI at this volume)
- **Re-evaluate when**: Sensor volume grows beyond ~500 msgs/sec or multiple consumers need the same event stream

### SDR-3: Each service owns its own Postgres schema/database
- **NFR Driver**: Microservices independence — avoids shared-database coupling that undermines the point of splitting services
- **Decision**: Auth DB, Shipment DB, Alert DB are separate logical databases (same Postgres instance is fine for MVP cost — separate instances only if isolation is proven necessary). Sensor data lives in TimescaleDB, owned by Ingestion Service, read by Alerting/Compliance via internal API, not direct DB access.
- **Alternatives**: Shared single database (rejected — defeats service boundary); separate DB instances per service (deferred — unnecessary infra cost at MVP scale)
- **Re-evaluate when**: A service needs independent scaling/backup policy from the others
