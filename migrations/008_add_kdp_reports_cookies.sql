-- Migration: Add kdp_reports_cookies_encrypted column to users table
-- This stores encrypted cookies from kdpreports.amazon.com for sales data scraping

-- Add the new column for kdpreports cookies
ALTER TABLE users
ADD COLUMN IF NOT EXISTS kdp_reports_cookies_encrypted TEXT;

-- Add comment explaining the column purpose
COMMENT ON COLUMN users.kdp_reports_cookies_encrypted IS 'Encrypted JSON of kdpreports.amazon.com cookies for sales/royalty data access';
