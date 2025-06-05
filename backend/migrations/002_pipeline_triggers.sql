-- 002_pipeline_triggers.sql
-- Migration to add trigger for automatic stopped_at timestamp update

-- Add stopped_at column if not exists
ALTER TABLE pipelines ADD COLUMN IF NOT EXISTS stopped_at TIMESTAMP WITH TIME ZONE;

-- Create function to update stopped_at when pipeline becomes inactive
CREATE OR REPLACE FUNCTION update_pipeline_stopped_at()
RETURNS TRIGGER AS $$
BEGIN
    -- If pipeline is being set to inactive (active = false)
    IF OLD.active = true AND NEW.active = false THEN
        NEW.stopped_at = CURRENT_TIMESTAMP;
        
        -- Log the change
        RAISE NOTICE 'Pipeline % (%) stopped at %', NEW.name, NEW.id, NEW.stopped_at;
    END IF;
    
    -- If pipeline is being reactivated (active = true)
    IF OLD.active = false AND NEW.active = true THEN
        NEW.stopped_at = NULL;
        
        -- Log the change
        RAISE NOTICE 'Pipeline % (%) reactivated', NEW.name, NEW.id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update stopped_at
DROP TRIGGER IF EXISTS trigger_update_pipeline_stopped_at ON pipelines;

CREATE TRIGGER trigger_update_pipeline_stopped_at
    BEFORE UPDATE ON pipelines
    FOR EACH ROW
    EXECUTE FUNCTION update_pipeline_stopped_at();

-- Create index for better query performance on stopped pipelines
CREATE INDEX IF NOT EXISTS idx_pipelines_stopped_at ON pipelines(stopped_at) WHERE stopped_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pipelines_active_status ON pipelines(active, created_at);

-- Add comments for documentation
COMMENT ON COLUMN pipelines.stopped_at IS 'Timestamp when pipeline was stopped (set automatically by trigger)';
COMMENT ON FUNCTION update_pipeline_stopped_at() IS 'Trigger function to automatically set stopped_at timestamp when pipeline becomes inactive';
COMMENT ON TRIGGER trigger_update_pipeline_stopped_at ON pipelines IS 'Automatically updates stopped_at when pipeline active status changes';

-- Show current pipeline statuses
SELECT 
    id,
    name,
    active,
    created_at,
    stopped_at,
    CASE 
        WHEN active THEN 'RUNNING'
        WHEN stopped_at IS NOT NULL THEN 'STOPPED'
        ELSE 'UNKNOWN'
    END as status
FROM pipelines 
ORDER BY created_at DESC;
