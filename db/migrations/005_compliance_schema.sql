CREATE SCHEMA IF NOT EXISTS compliance;

CREATE TABLE compliance.exports (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id   UUID NOT NULL UNIQUE,
  generated_by  UUID NOT NULL,
  reading_hash  TEXT NOT NULL,
  file_path     TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
