-- Database Migration: Add Parent Phone Number Fields
-- This script adds parent1_number and parent2_number fields to the users table

-- Add phone number columns to the users table (if they don't exist)
-- Note: phone_number might already exist, so we'll use IF NOT EXISTS logic
DO $$ 
BEGIN
    -- Add phone_number if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'phone_number') THEN
        ALTER TABLE users ADD COLUMN phone_number VARCHAR(20);
    END IF;
    
    -- Add parent phone number columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'parent1_number') THEN
        ALTER TABLE users ADD COLUMN parent1_number VARCHAR(20);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'parent2_number') THEN
        ALTER TABLE users ADD COLUMN parent2_number VARCHAR(20);
    END IF;
END $$;

-- Add comments to document the new columns
COMMENT ON COLUMN users.phone_number IS 'Student personal phone number';
COMMENT ON COLUMN users.parent1_number IS 'Primary parent/guardian phone number for student lookup';
COMMENT ON COLUMN users.parent2_number IS 'Secondary parent/guardian phone number for student lookup';

-- Create indexes for better search performance on phone numbers
CREATE INDEX IF NOT EXISTS idx_users_phone_number ON users(phone_number) WHERE phone_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_parent1_number ON users(parent1_number) WHERE parent1_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_parent2_number ON users(parent2_number) WHERE parent2_number IS NOT NULL;

-- Optional: Update existing students with sample parent numbers (replace with actual data)
-- UPDATE users 
-- SET parent1_number = '+1234567890' 
-- WHERE role = 'student' AND parent1_number IS NULL;

-- Verify the changes
SELECT 
    id, 
    name, 
    role, 
    phone_number,
    parent1_number, 
    parent2_number 
FROM users 
WHERE role = 'student' 
LIMIT 5;
