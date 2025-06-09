-- 007_custom_pipeline_metrics_support.sql
-- Migration to support custom pipeline metrics

-- Drop existing foreign key constraints
ALTER TABLE pipeline_metrics DROP CONSTRAINT IF EXISTS fk_pipeline_metrics_pipeline_id;
ALTER TABLE pipeline_metrics DROP CONSTRAINT IF EXISTS pipeline_metrics_pipeline_id_fkey;

-- Drop existing indexes that depend on the foreign key
DROP INDEX IF EXISTS idx_pipeline_metrics_pipeline_time;

-- Recreate the index without foreign key dependency
CREATE INDEX idx_pipeline_metrics_pipeline_time ON pipeline_metrics(pipeline_id, collected_at DESC);

-- Add a check constraint to ensure pipeline_id exists in either pipelines or custom_pipelines
-- This is a more flexible approach than foreign key constraints
CREATE OR REPLACE FUNCTION validate_pipeline_exists(uuid)
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM pipelines WHERE id = $1 AND deleted = false
        UNION
        SELECT 1 FROM custom_pipelines WHERE id = $1 AND deleted = false
    );
END;
$$ LANGUAGE plpgsql;

-- Add check constraint using the function
ALTER TABLE pipeline_metrics 
ADD CONSTRAINT chk_pipeline_exists 
CHECK (validate_pipeline_exists(pipeline_id));

-- Do the same for pipeline_alerts table
ALTER TABLE pipeline_alerts DROP CONSTRAINT IF EXISTS fk_pipeline_alerts_pipeline_id;
ALTER TABLE pipeline_alerts DROP CONSTRAINT IF EXISTS pipeline_alerts_pipeline_id_fkey;

ALTER TABLE pipeline_alerts 
ADD CONSTRAINT chk_pipeline_alerts_exists 
CHECK (validate_pipeline_exists(pipeline_id));

-- Do the same for monitoring_config table  
ALTER TABLE monitoring_config DROP CONSTRAINT IF EXISTS monitoring_config_pipeline_id_fkey;

-- For monitoring_config, pipeline_id can be NULL (global config)
ALTER TABLE monitoring_config 
ADD CONSTRAINT chk_monitoring_config_exists 
CHECK (pipeline_id IS NULL OR validate_pipeline_exists(pipeline_id));

-- Add comments to document the change
COMMENT ON FUNCTION validate_pipeline_exists(uuid) IS 'Validates that pipeline ID exists in either pipelines or custom_pipelines table';
COMMENT ON CONSTRAINT chk_pipeline_exists ON pipeline_metrics IS 'Ensures pipeline_id exists in pipelines or custom_pipelines table';
COMMENT ON CONSTRAINT chk_pipeline_alerts_exists ON pipeline_alerts IS 'Ensures pipeline_id exists in pipelines or custom_pipelines table';
COMMENT ON CONSTRAINT chk_monitoring_config_exists ON monitoring_config IS 'Ensures pipeline_id exists in pipelines or custom_pipelines table when not NULL';
