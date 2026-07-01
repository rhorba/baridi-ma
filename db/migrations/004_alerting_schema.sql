CREATE SCHEMA IF NOT EXISTS alerting;

CREATE TABLE alerting.alerts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id  UUID NOT NULL,
  device_id    UUID NOT NULL,
  reading_time TIMESTAMPTZ NOT NULL,
  reason       TEXT NOT NULL,
  value        NUMERIC(4,1) NOT NULL,
  threshold    NUMERIC(4,1) NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_alerts_shipment ON alerting.alerts (shipment_id);
