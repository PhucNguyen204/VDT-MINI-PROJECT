-- 009_optimize_migrations.sql
-- Migration to optimize and clean up database structure

-- First, check if log_level column exists and add it if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'custom_pipeline_logs' 
        AND column_name = 'log_level'
    ) THEN
        ALTER TABLE custom_pipeline_logs 
        ADD COLUMN log_level VARCHAR(10) NOT NULL DEFAULT 'INFO';
    END IF;
END $$;

-- Ensure timestamp column exists (rename created_at if needed)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'custom_pipeline_logs' 
        AND column_name = 'timestamp'
    ) THEN
        -- If created_at exists but timestamp doesn't, rename it
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'custom_pipeline_logs' 
            AND column_name = 'created_at'
        ) THEN
            ALTER TABLE custom_pipeline_logs 
            RENAME COLUMN created_at TO timestamp;
        ELSE
            -- Add timestamp column if neither exists
            ALTER TABLE custom_pipeline_logs 
            ADD COLUMN timestamp TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP;
        END IF;
    END IF;
END $$;

-- Update validate_pipeline_exists function to only check custom_pipelines
CREATE OR REPLACE FUNCTION validate_pipeline_exists(pipeline_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- Only check custom_pipelines table (since pipelines table was dropped)
    RETURN EXISTS (
        SELECT 1 FROM custom_pipelines 
        WHERE id = pipeline_uuid AND deleted = false
    );
END;
$$ LANGUAGE plpgsql;

-- Ensure all constraints reference the correct function
ALTER TABLE pipeline_metrics DROP CONSTRAINT IF EXISTS chk_pipeline_exists;
ALTER TABLE pipeline_metrics ADD CONSTRAINT chk_pipeline_exists 
    CHECK (validate_pipeline_exists(pipeline_id));

-- Add missing constraints if they don't exist
DO $$
BEGIN
    -- Check if pipeline_alerts table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pipeline_alerts') THEN
        ALTER TABLE pipeline_alerts DROP CONSTRAINT IF EXISTS chk_pipeline_alerts_exists;
        ALTER TABLE pipeline_alerts ADD CONSTRAINT chk_pipeline_alerts_exists 
            CHECK (validate_pipeline_exists(pipeline_id));
    END IF;
    
    -- Check if monitoring_config table exists  
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'monitoring_config') THEN
        ALTER TABLE monitoring_config DROP CONSTRAINT IF EXISTS chk_monitoring_config_exists;
        ALTER TABLE monitoring_config ADD CONSTRAINT chk_monitoring_config_exists 
            CHECK (pipeline_id IS NULL OR validate_pipeline_exists(pipeline_id));
    END IF;
END $$;

-- Add comments for documentation
COMMENT ON FUNCTION validate_pipeline_exists(uuid) IS 'Validates that pipeline ID exists in custom_pipelines table only';
COMMENT ON TABLE custom_pipelines IS 'Main table for custom data processing pipelines';
COMMENT ON TABLE custom_pipeline_logs IS 'Audit log for pipeline actions and events';
COMMENT ON TABLE pipeline_metrics IS 'Real-time metrics collected from pipelines';

-- Show optimization results
SELECT 
    'Database optimization completed' as status,
    (SELECT COUNT(*) FROM information_schema.tables 
     WHERE table_schema = 'public' 
     AND table_name NOT LIKE 'pg_%'
    ) as total_tables,
    (SELECT COUNT(*) FROM custom_pipelines) as pipelines_count,
    (SELECT COUNT(*) FROM custom_pipeline_logs) as logs_count,
    (SELECT COUNT(*) FROM pipeline_metrics) as metrics_count;
