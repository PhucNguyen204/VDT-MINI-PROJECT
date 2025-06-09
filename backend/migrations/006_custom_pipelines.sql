-- 006_custom_pipelines.sql
-- Tạo bảng cho custom pipelines với configuration phức tạp

CREATE TABLE IF NOT EXISTS custom_pipelines (
  id           UUID PRIMARY KEY,
  name         TEXT NOT NULL,
  description  TEXT,
  
  -- Lưu configuration dưới dạng JSON
  sources_config      JSONB NOT NULL,  -- Configuration của tất cả sources
  transforms_config   JSONB NOT NULL,  -- Configuration của transforms cho mỗi source
  sinks_config       JSONB NOT NULL,  -- Configuration của sinks cho mỗi source
  
  -- Container và file information
  container_id TEXT,
  config_path  TEXT,
  
  -- Port mapping cho các source cần expose port
  exposed_ports JSONB DEFAULT '[]'::jsonb,  -- Array of port mappings
  
  -- Metadata
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now(),
  started_at   TIMESTAMPTZ,
  stopped_at   TIMESTAMPTZ,
  
  -- Status tracking
  status       TEXT DEFAULT 'created' CHECK (status IN ('created', 'starting', 'running', 'stopping', 'stopped', 'error')),
  error_message TEXT,
  
  -- Flags
  active       BOOLEAN DEFAULT true,
  deleted      BOOLEAN DEFAULT false
);

-- Index để tìm kiếm nhanh
CREATE INDEX IF NOT EXISTS idx_custom_pipelines_name ON custom_pipelines(name);
CREATE INDEX IF NOT EXISTS idx_custom_pipelines_status ON custom_pipelines(status);
CREATE INDEX IF NOT EXISTS idx_custom_pipelines_active ON custom_pipelines(active, deleted);
CREATE INDEX IF NOT EXISTS idx_custom_pipelines_created_at ON custom_pipelines(created_at);

-- Index cho JSONB fields để search trong configuration
CREATE INDEX IF NOT EXISTS idx_custom_pipelines_sources_gin ON custom_pipelines USING gin(sources_config);
CREATE INDEX IF NOT EXISTS idx_custom_pipelines_sinks_gin ON custom_pipelines USING gin(sinks_config);

-- Function để update updated_at timestamp
CREATE OR REPLACE FUNCTION update_custom_pipeline_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger để tự động update updated_at
CREATE TRIGGER custom_pipeline_updated_at
  BEFORE UPDATE ON custom_pipelines
  FOR EACH ROW
  EXECUTE FUNCTION update_custom_pipeline_updated_at();

-- Tạo bảng logs cho custom pipelines để track history
CREATE TABLE IF NOT EXISTS custom_pipeline_logs (
  id           SERIAL PRIMARY KEY,
  pipeline_id  UUID REFERENCES custom_pipelines(id) ON DELETE CASCADE,
  action       TEXT NOT NULL,  -- 'created', 'started', 'stopped', 'error', etc.
  message      TEXT,
  metadata     JSONB DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_custom_pipeline_logs_pipeline_id ON custom_pipeline_logs(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_custom_pipeline_logs_action ON custom_pipeline_logs(action);
CREATE INDEX IF NOT EXISTS idx_custom_pipeline_logs_created_at ON custom_pipeline_logs(created_at);
