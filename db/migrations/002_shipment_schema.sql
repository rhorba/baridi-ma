CREATE SCHEMA IF NOT EXISTS shipment;

CREATE TABLE shipment.devices (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_token  TEXT NOT NULL UNIQUE,
  label         TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE shipment.shipments (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipper_id         UUID NOT NULL,
  carrier_id         UUID,
  receiver_id        UUID NOT NULL,
  assigned_device_id UUID REFERENCES shipment.devices(id),
  product_type       TEXT NOT NULL,
  origin             TEXT NOT NULL,
  destination        TEXT NOT NULL,
  temp_min_c         NUMERIC(4,1) NOT NULL,
  temp_max_c         NUMERIC(4,1) NOT NULL,
  humidity_min_pct   NUMERIC(4,1),
  humidity_max_pct   NUMERIC(4,1),
  status             TEXT NOT NULL DEFAULT 'created'
                      CHECK (status IN ('created', 'in_transit', 'delivered', 'cancelled')),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_shipments_shipper ON shipment.shipments (shipper_id);
CREATE INDEX idx_shipments_carrier ON shipment.shipments (carrier_id);
CREATE INDEX idx_shipments_receiver ON shipment.shipments (receiver_id);
CREATE INDEX idx_shipments_device ON shipment.shipments (assigned_device_id);

CREATE TABLE shipment.audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID NOT NULL REFERENCES shipment.shipments(id),
  actor_id    UUID NOT NULL,
  action      TEXT NOT NULL,
  details     JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_shipment ON shipment.audit_log (shipment_id);
