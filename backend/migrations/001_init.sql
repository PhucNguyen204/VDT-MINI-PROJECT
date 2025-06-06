-- 001_create_pipelines_table.sql
CREATE TABLE IF NOT EXISTS pipelines (
  id           UUID PRIMARY KEY,
  name         TEXT NOT NULL,
  tag          TEXT,
  source_type  TEXT,
  sink_type    TEXT,
  config_path  TEXT,
  container_id TEXT,
  created_at   TIMESTAMPTZ DEFAULT now(),
  stopped_at   TIMESTAMPTZ,
  active       BOOLEAN DEFAULT true,
  deleted      BOOLEAN DEFAULT false
);