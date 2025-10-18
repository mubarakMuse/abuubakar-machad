-- Rollback script to remove order_index column and related changes
-- This will revert the database to its original state before drag and drop functionality

-- Drop the index first
DROP INDEX IF EXISTS idx_assignments_order_index;

-- Drop the order_index column
ALTER TABLE assignments DROP COLUMN IF EXISTS order_index;


