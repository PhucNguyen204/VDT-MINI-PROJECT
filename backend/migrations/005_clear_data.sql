-- Clear data from specified tables

TRUNCATE TABLE pipelines RESTART IDENTITY CASCADE;
TRUNCATE TABLE pipeline_metrics RESTART IDENTITY CASCADE;
TRUNCATE TABLE pipeline_alerts RESTART IDENTITY CASCADE;
TRUNCATE TABLE monitoring_config RESTART IDENTITY CASCADE;

-- Add any other tables that need to be cleared here
-- Example: TRUNCATE TABLE another_table RESTART IDENTITY CASCADE;

-- Optional: Add a log message or a version update if your migration system supports it
-- INSERT INTO schema_migrations (version) VALUES ('005');
