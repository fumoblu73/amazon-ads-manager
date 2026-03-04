-- ================================================
-- Migration 007: Add user_id to campaigns table
-- ================================================
-- This migration associates campaigns with specific users,
-- enabling per-user campaign management and automations.

-- Add user_id column
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS user_id UUID;

-- Add foreign key constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_campaigns_user' AND table_name = 'campaigns'
  ) THEN
    ALTER TABLE campaigns
      ADD CONSTRAINT fk_campaigns_user
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add index for efficient user-based queries
CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON campaigns(user_id);

-- Add composite index for user + marketplace queries
CREATE INDEX IF NOT EXISTS idx_campaigns_user_marketplace ON campaigns(user_id, marketplace);

-- Add composite index for user + state queries
CREATE INDEX IF NOT EXISTS idx_campaigns_user_state ON campaigns(user_id, state);

-- Verify changes
COMMENT ON COLUMN campaigns.user_id IS 'User who owns this campaign (from OAuth authentication)';
