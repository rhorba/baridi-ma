CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE SCHEMA IF NOT EXISTS ingestion;

CREATE TABLE ingestion.sensor_readings (
  device_id     UUID NOT NULL,
  time          TIMESTAMPTZ NOT NULL,
  temperature_c NUMERIC(4,1) NOT NULL,
  humidity_pct  NUMERIC(4,1),
  PRIMARY KEY (device_id, time)
);

SELECT create_hypertable('ingestion.sensor_readings', 'time');

CREATE ROLE ingestion_service_role NOLOGIN;
GRANT USAGE ON SCHEMA ingestion TO ingestion_service_role;
GRANT SELECT, INSERT ON ingestion.sensor_readings TO ingestion_service_role;
REVOKE UPDATE, DELETE ON ingestion.sensor_readings FROM ingestion_service_role;
