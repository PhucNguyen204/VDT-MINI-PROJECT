-- 004_monitoring_tables.sql
-- Migration to create monitoring tables for pipeline metrics

-- Create pipeline_metrics table to store real-time metrics
CREATE TABLE IF NOT EXISTS pipeline_metrics (
    id SERIAL PRIMARY KEY,
    pipeline_id UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
    metric_type VARCHAR(50) NOT NULL, -- 'throughput', 'error', 'buffer', 'health'
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(15,4),
    unit VARCHAR(20), -- 'events/sec', 'bytes', 'count', 'percent', 'ms'
    collected_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_pipeline_metrics_pipeline_id FOREIGN KEY (pipeline_id) REFERENCES pipelines(id)
);

-- Create pipeline_alerts table for threshold-based alerts
CREATE TABLE IF NOT EXISTS pipeline_alerts (
    id SERIAL PRIMARY KEY,
    pipeline_id UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
    alert_type VARCHAR(50) NOT NULL, -- 'buffer_overflow', 'high_error_rate', 'pipeline_dead', 'performance_degraded'
    severity VARCHAR(20) NOT NULL DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
    message TEXT NOT NULL,
    threshold_value DECIMAL(15,4),
    actual_value DECIMAL(15,4),
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'resolved', 'acknowledged'
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMPTZ,
    
    CONSTRAINT fk_pipeline_alerts_pipeline_id FOREIGN KEY (pipeline_id) REFERENCES pipelines(id)
);

-- Create monitoring_config table for alert thresholds
CREATE TABLE IF NOT EXISTS monitoring_config (
    id SERIAL PRIMARY KEY,
    pipeline_id UUID REFERENCES pipelines(id) ON DELETE CASCADE, -- NULL = global config
    config_key VARCHAR(100) NOT NULL,
    config_value VARCHAR(500) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(pipeline_id, config_key)
);

-- Indexes for better query performance
CREATE INDEX idx_pipeline_metrics_pipeline_time ON pipeline_metrics(pipeline_id, collected_at DESC);
CREATE INDEX idx_pipeline_metrics_type_time ON pipeline_metrics(metric_type, collected_at DESC);
CREATE INDEX idx_pipeline_alerts_status ON pipeline_alerts(status, created_at DESC);
CREATE INDEX idx_pipeline_alerts_pipeline ON pipeline_alerts(pipeline_id, status);

-- Insert default monitoring configuration
INSERT INTO monitoring_config (pipeline_id, config_key, config_value) VALUES 
-- Global thresholds (pipeline_id = NULL)
(NULL, 'buffer_threshold_high', '80'),          -- 80% buffer usage warning
(NULL, 'buffer_threshold_critical', '95'),      -- 95% buffer usage critical
(NULL, 'error_rate_threshold', '5'),            -- 5% error rate warning
(NULL, 'throughput_min_threshold', '1'),        -- Minimum 1 event/sec
(NULL, 'pipeline_dead_timeout_minutes', '5'),   -- 5 minutes no activity = dead
(NULL, 'metrics_collection_interval_sec', '30'), -- Collect metrics every 30 seconds
(NULL, 'alert_cooldown_minutes', '10')          -- 10 minutes cooldown between same alerts
ON CONFLICT (pipeline_id, config_key) DO NOTHING;

-- Create function to update monitoring_config updated_at
CREATE OR REPLACE FUNCTION update_monitoring_config_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for monitoring_config
CREATE TRIGGER trigger_update_monitoring_config
    BEFORE UPDATE ON monitoring_config
    FOR EACH ROW
    EXECUTE FUNCTION update_monitoring_config_timestamp();

-- Comments for documentation
COMMENT ON TABLE pipeline_metrics IS 'Real-time metrics collected from Vector API for each pipeline';
COMMENT ON TABLE pipeline_alerts IS 'Alert records when pipeline metrics exceed thresholds';
COMMENT ON TABLE monitoring_config IS 'Configuration for monitoring thresholds and alert rules';

-- Show current monitoring setup
SELECT 
    'Monitoring tables created' as status,
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_name IN ('pipeline_metrics', 'pipeline_alerts', 'monitoring_config')) as table_count;
