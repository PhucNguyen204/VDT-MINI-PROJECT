-- 008_cleanup_old_pipeline_tables.sql
-- Migration to remove old single/multiple pipeline tables and keep only custom pipeline functionality

-- Drop the old pipelines table that was used for single/multiple pipelines
DROP TABLE IF EXISTS pipelines CASCADE;

-- Update validation function to only check custom_pipelines table
DROP FUNCTION IF EXISTS validate_pipeline_exists(UUID);

CREATE OR REPLACE FUNCTION validate_pipeline_exists(pipeline_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- Only check custom_pipelines table now
    RETURN EXISTS (
        SELECT 1 FROM custom_pipelines WHERE id = pipeline_uuid AND deleted = false
    );
END;
$$ LANGUAGE plpgsql;

-- Update check constraints to reflect the change
ALTER TABLE pipeline_metrics DROP CONSTRAINT IF EXISTS chk_pipeline_exists;
ALTER TABLE pipeline_metrics ADD CONSTRAINT chk_pipeline_exists 
    CHECK (validate_pipeline_exists(pipeline_id));

ALTER TABLE pipeline_alerts DROP CONSTRAINT IF EXISTS chk_pipeline_exists;
ALTER TABLE pipeline_alerts ADD CONSTRAINT chk_pipeline_exists 
    CHECK (validate_pipeline_exists(pipeline_id));

ALTER TABLE monitoring_config DROP CONSTRAINT IF EXISTS chk_pipeline_exists;
ALTER TABLE monitoring_config ADD CONSTRAINT chk_pipeline_exists 
    CHECK (pipeline_id IS NULL OR validate_pipeline_exists(pipeline_id));

-- Show current table status
SELECT 
    'Cleanup completed' as status,
    (SELECT COUNT(*) FROM information_schema.tables 
     WHERE table_name IN ('custom_pipelines', 'custom_pipeline_logs', 'pipeline_metrics', 'pipeline_alerts', 'monitoring_config')
    ) as remaining_tables,
    (SELECT COUNT(*) FROM custom_pipelines) as custom_pipelines_count;

-- List remaining tables
SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
