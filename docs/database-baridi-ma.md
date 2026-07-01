# Database Design: Baridi.ma
**Architecture Reference**: docs/architecture-baridi-ma.md
**Version**: 1.0 | **Date**: 2026-07-01 | **Author**: DBA

## 1. Database Selection
- **Engine**: PostgreSQL 16 + TimescaleDB extension (per README/PRD — sensor time-series needs hypertables)
- **Rationale**: Postgres is the YAGNI default; TimescaleDB extension (not a separate DB) gives efficient time-series storage/queries for sensor readings without adding a second database technology
- **Hosting**: Single managed Postgres instance for MVP (e.g. a small managed Postgres with TimescaleDB support), per-service logical schemas

## 2. Entity-Relationship Model
```
User ──1:N──> Shipment (shipper_id)
User ──0:N──> Shipment (carrier_id, nullable)
User ──1:N──> Shipment (receiver_id)
Shipment ──0:1──> Device (assigned_device_id, nullable until dispatched)
Device ──1:N──> SensorReading (hypertable, device_id + time)
Shipment ──1:N──> Alert
Shipment ──0:1──> ComplianceExport
User ──1:N──> AuditLog (actor_id)
```

## 3. Schema Design

```sql
-- ===== auth schema =====
CREATE SCHEMA auth;

CREATE TABLE auth.users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL,
  phone         TEXT,
  role          TEXT NOT NULL CHECK (role IN ('shipper', 'carrier', 'receiver', 'admin')),
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ===== shipment schema =====
CREATE SCHEMA shipment;

CREATE TABLE shipment.devices (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_token  TEXT NOT NULL UNIQUE, -- per-device credential
  label         TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE shipment.shipments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipper_id        UUID NOT NULL,     -- references auth.users(id), cross-schema FK enforced at app layer
  carrier_id        UUID,
  receiver_id       UUID NOT NULL,
  assigned_device_id UUID REFERENCES shipment.devices(id),
  product_type      TEXT NOT NULL,
  origin            TEXT NOT NULL,
  destination       TEXT NOT NULL,
  temp_min_c        NUMERIC(4,1) NOT NULL,
  temp_max_c        NUMERIC(4,1) NOT NULL,
  humidity_min_pct  NUMERIC(4,1),
  humidity_max_pct  NUMERIC(4,1),
  status            TEXT NOT NULL DEFAULT 'created'
                     CHECK (status IN ('created', 'in_transit', 'delivered', 'cancelled')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE shipment.audit_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id   UUID NOT NULL REFERENCES shipment.shipments(id),
  actor_id      UUID NOT NULL, -- references auth.users(id)
  action        TEXT NOT NULL, -- e.g. 'status_changed', 'carrier_assigned'
  details       JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ===== ingestion schema (TimescaleDB) =====
CREATE SCHEMA ingestion;

CREATE TABLE ingestion.sensor_readings (
  device_id     UUID NOT NULL,          -- references shipment.devices(id)
  time          TIMESTAMPTZ NOT NULL,
  temperature_c NUMERIC(4,1) NOT NULL,
  humidity_pct  NUMERIC(4,1),
  PRIMARY KEY (device_id, time)
);
SELECT create_hypertable('ingestion.sensor_readings', 'time');

-- Append-only enforcement: no UPDATE/DELETE grants to the ingestion service DB role
REVOKE UPDATE, DELETE ON ingestion.sensor_readings FROM ingestion_service_role;

-- ===== alerting schema =====
CREATE SCHEMA alerting;

CREATE TABLE alerting.alerts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id   UUID NOT NULL, -- references shipment.shipments(id)
  device_id     UUID NOT NULL,
  reading_time  TIMESTAMPTZ NOT NULL,
  reason        TEXT NOT NULL, -- 'temp_high', 'temp_low', 'humidity_high', 'humidity_low'
  value         NUMERIC(4,1) NOT NULL,
  threshold     NUMERIC(4,1) NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ===== compliance schema =====
CREATE SCHEMA compliance;

CREATE TABLE compliance.exports (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id   UUID NOT NULL UNIQUE, -- one export per shipment for MVP
  generated_by  UUID NOT NULL, -- references auth.users(id)
  reading_hash  TEXT NOT NULL, -- SHA-256 of the reading set at export time
  file_path     TEXT NOT NULL, -- local volume path for MVP, S3 key post-MVP
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

## 4. Index Strategy
| Table | Index Name | Columns | Query Pattern |
|---|---|---|---|
| shipment.shipments | idx_shipments_shipper | shipper_id | "my shipments" for Shipper |
| shipment.shipments | idx_shipments_carrier | carrier_id | "assigned shipments" for Carrier |
| shipment.shipments | idx_shipments_receiver | receiver_id | "incoming shipments" for Receiver |
| shipment.shipments | idx_shipments_device | assigned_device_id | lookup shipment by device on ingestion |
| ingestion.sensor_readings | (hypertable auto-index on device_id, time) | device_id, time | time-range queries per device (compliance export, live view) |
| alerting.alerts | idx_alerts_shipment | shipment_id | "alerts for this shipment" |
| shipment.audit_log | idx_audit_shipment | shipment_id | shipment history view |

## 5. Migration Plan
| Migration File | Description | Reversible |
|---|---|---|
| 001_auth_schema.sql | Create auth schema + users table | Yes |
| 002_shipment_schema.sql | Create shipment schema, devices, shipments, audit_log | Yes |
| 003_ingestion_schema.sql | Create ingestion schema, sensor_readings hypertable, revoke write perms | Yes |
| 004_alerting_schema.sql | Create alerting schema, alerts table | Yes |
| 005_compliance_schema.sql | Create compliance schema, exports table | Yes |

## 6. Access Patterns
| Use Case | Query Pattern | Index Coverage |
|---|---|---|
| Shipper views their shipments | SELECT WHERE shipper_id = ? | idx_shipments_shipper |
| Live shipment view (latest reading) | SELECT ... WHERE device_id = ? ORDER BY time DESC LIMIT 1 | hypertable index |
| Compliance export (full history) | SELECT WHERE device_id = ? AND time BETWEEN shipment.created_at AND delivered_at | hypertable index |
| Alerting evaluates new reading | SELECT threshold fields WHERE assigned_device_id = ? | idx_shipments_device |

## 7. Sensitive Data
- Columns requiring encryption: none at column level for MVP (no payment data stored — stubbed); `password_hash` uses bcrypt/argon2, not reversible encryption
- Row-level security needed: not enforced at the DB level for MVP — ownership checks happen at the service layer (per Security baseline); consider Postgres RLS post-MVP if service-layer checks prove insufficient
