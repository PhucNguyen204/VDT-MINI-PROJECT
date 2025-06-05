-- Migration: Add deleted column to pipelines table
-- Date: 2025-06-06

-- Add deleted column with default value false
ALTER TABLE pipelines 
ADD COLUMN deleted BOOLEAN DEFAULT FALSE;

-- Add index for better query performance
CREATE INDEX idx_pipelines_deleted ON pipelines(deleted);

-- Add index for common queries (active and not deleted)
CREATE INDEX idx_pipelines_active_not_deleted ON pipelines(active, deleted) WHERE deleted = FALSE;

-- Update existing records to have deleted = false
UPDATE pipelines SET deleted = FALSE WHERE deleted IS NULL;

-- Add constraint to ensure deleted is not null
ALTER TABLE pipelines ALTER COLUMN deleted SET NOT NULL;
