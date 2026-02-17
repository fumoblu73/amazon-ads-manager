-- Add campaign_last_sync_at column to users table
-- Tracks when campaigns were last auto-synced from Amazon Ads API

ALTER TABLE users ADD COLUMN IF NOT EXISTS campaign_last_sync_at TIMESTAMP;
