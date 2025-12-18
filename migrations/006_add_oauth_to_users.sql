-- ================================================
-- Migration 006: Add OAuth fields to users table
-- ================================================
-- This migration adds Amazon OAuth authentication fields to support
-- per-user Amazon Ads API access instead of global refresh token.

-- Add OAuth columns
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS amazon_user_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS access_token TEXT,
  ADD COLUMN IF NOT EXISTS refresh_token TEXT,
  ADD COLUMN IF NOT EXISTS profile_id BIGINT,
  ADD COLUMN IF NOT EXISTS country_code VARCHAR(10),
  ADD COLUMN IF NOT EXISTS currency_code VARCHAR(10),
  ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS name VARCHAR(255);

-- Make password_hash nullable (OAuth users don't need password)
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

-- Add unique index on amazon_user_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_amazon_user_id ON users(amazon_user_id);

-- Add index on is_active for efficient querying of active users
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);

-- Add index on email (if not exists)
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Verify changes
COMMENT ON COLUMN users.amazon_user_id IS 'Amazon user ID from OAuth (unique identifier from Login with Amazon)';
COMMENT ON COLUMN users.access_token IS 'Current Amazon Ads API access token (expires after ~1 hour)';
COMMENT ON COLUMN users.refresh_token IS 'Amazon Ads API refresh token (used to get new access tokens)';
COMMENT ON COLUMN users.profile_id IS 'Primary Amazon Ads profile ID for this user';
COMMENT ON COLUMN users.country_code IS 'Amazon marketplace country code (e.g., US, UK, DE)';
COMMENT ON COLUMN users.currency_code IS 'Currency code for the marketplace (e.g., USD, GBP, EUR)';
COMMENT ON COLUMN users.token_expires_at IS 'Timestamp when the access token expires';
COMMENT ON COLUMN users.last_login_at IS 'Last successful OAuth login timestamp';
COMMENT ON COLUMN users.is_active IS 'Whether the user account is active (false if token refresh fails)';
COMMENT ON COLUMN users.name IS 'User display name from Amazon profile';
