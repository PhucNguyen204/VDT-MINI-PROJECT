CREATE OR REPLACE FUNCTION validate_pipeline_exists(pipeline_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM custom_pipelines 
        WHERE id = pipeline_uuid
    );
END;
$$ LANGUAGE plpgsql;

-- Add foreign key constraints
ALTER TABLE pipeline_metrics 
ADD CONSTRAINT fk_pipeline_metrics_pipeline_id 
FOREIGN KEY (pipeline_id) REFERENCES custom_pipelines(id) ON DELETE CASCADE;

ALTER TABLE pipeline_alerts 
ADD CONSTRAINT fk_pipeline_alerts_pipeline_id 
FOREIGN KEY (pipeline_id) REFERENCES custom_pipelines(id) ON DELETE CASCADE;

ALTER TABLE monitoring_config 
ADD CONSTRAINT fk_monitoring_config_pipeline_id 
FOREIGN KEY (pipeline_id) REFERENCES custom_pipelines(id) ON DELETE CASCADE;
