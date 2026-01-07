-- Migration: Add KDP Sync columns to users table
-- Created: 2025-12-29

ALTER TABLE users
ADD COLUMN IF NOT EXISTS kdp_cookies_encrypted TEXT,
ADD COLUMN IF NOT EXISTS kdp_marketplace VARCHAR(50),
ADD COLUMN IF NOT EXISTS kdp_cookies_updated_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS kdp_last_sync_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS kdp_sync_enabled BOOLEAN DEFAULT false;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_kdp_sync_enabled ON users(kdp_sync_enabled);
CREATE INDEX IF NOT EXISTS idx_users_kdp_marketplace ON users(kdp_marketplace);
CREATE INDEX IF NOT EXISTS idx_users_kdp_last_sync ON users(kdp_last_sync_at);

-- Verify columns were added
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'users'
  AND column_name LIKE 'kdp%'
ORDER BY column_name;
