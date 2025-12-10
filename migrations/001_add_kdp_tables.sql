-- ============================================
-- KDP INTEGRATION - DATABASE MIGRATION
-- ============================================
-- Adds tables for KDP books, stats, authentication, and journal events

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- KDP Books
CREATE TABLE IF NOT EXISTS kdp_books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  asin VARCHAR(10) NOT NULL,
  title VARCHAR(500) NOT NULL,
  author VARCHAR(200),
  marketplace VARCHAR(10) NOT NULL,

  -- Serie info
  series_name VARCHAR(200),
  series_position INTEGER,

  -- Metadata
  publish_date DATE,
  cover_url TEXT,

  -- Link a campagne ads (opzionale)
  linked_campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT kdp_books_unique_user_asin_marketplace UNIQUE(user_id, asin, marketplace)
);

-- Indexes for kdp_books
CREATE INDEX IF NOT EXISTS idx_kdp_books_user ON kdp_books(user_id);
CREATE INDEX IF NOT EXISTS idx_kdp_books_marketplace ON kdp_books(marketplace);

-- KDP Daily Stats (per ROI e BSR tracking)
CREATE TABLE IF NOT EXISTS kdp_daily_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID REFERENCES kdp_books(id) ON DELETE CASCADE,
  date DATE NOT NULL,

  -- Vendite per formato
  ebook_sales INTEGER DEFAULT 0,
  ebook_royalty DECIMAL(10,2) DEFAULT 0,
  paperback_sales INTEGER DEFAULT 0,
  paperback_royalty DECIMAL(10,2) DEFAULT 0,
  hardcover_sales INTEGER DEFAULT 0,
  hardcover_royalty DECIMAL(10,2) DEFAULT 0,

  -- Kindle Unlimited
  kenp_reads INTEGER DEFAULT 0,
  kenp_royalty DECIMAL(10,2) DEFAULT 0,

  -- Best Seller Rank (per BSR tracking)
  bsr INTEGER,

  -- Spesa pubblicitaria collegata (per ROI)
  ad_spend DECIMAL(10,2) DEFAULT 0,

  created_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT kdp_daily_stats_unique_book_date UNIQUE(book_id, date)
);

-- Indexes for kdp_daily_stats
CREATE INDEX IF NOT EXISTS idx_kdp_stats_date ON kdp_daily_stats(date);
CREATE INDEX IF NOT EXISTS idx_kdp_stats_book_date ON kdp_daily_stats(book_id, date DESC);

-- Journal Events (annotazioni su grafici)
CREATE TABLE IF NOT EXISTS journal_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  book_id UUID REFERENCES kdp_books(id) ON DELETE CASCADE,
  event_date DATE NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  category VARCHAR(50), -- 'price_change', 'ad_launch', 'promo', 'republish', 'milestone'

  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for journal_events
CREATE INDEX IF NOT EXISTS idx_events_user ON journal_events(user_id);
CREATE INDEX IF NOT EXISTS idx_events_book_date ON journal_events(book_id, event_date);

-- KDP Sync Log
CREATE TABLE IF NOT EXISTS kdp_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  sync_type VARCHAR(50) NOT NULL, -- 'extension', 'manual', 'auto'
  status VARCHAR(20) NOT NULL, -- 'success', 'error', 'partial'
  books_updated INTEGER DEFAULT 0,
  error_message TEXT,
  duration_ms INTEGER,

  created_at TIMESTAMP DEFAULT NOW()
);

-- Index for kdp_sync_log
CREATE INDEX IF NOT EXISTS idx_sync_log_user_date ON kdp_sync_log(user_id, created_at DESC);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE kdp_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE kdp_daily_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE kdp_sync_log ENABLE ROW LEVEL SECURITY;

-- Policies: Allow backend full access (service_role bypasses these)
CREATE POLICY "Allow backend full access to users"
ON users FOR ALL TO authenticated, anon USING (false);

CREATE POLICY "Allow backend full access to kdp_books"
ON kdp_books FOR ALL TO authenticated, anon USING (false);

CREATE POLICY "Allow backend full access to kdp_daily_stats"
ON kdp_daily_stats FOR ALL TO authenticated, anon USING (false);

CREATE POLICY "Allow backend full access to journal_events"
ON journal_events FOR ALL TO authenticated, anon USING (false);

CREATE POLICY "Allow backend full access to kdp_sync_log"
ON kdp_sync_log FOR ALL TO authenticated, anon USING (false);

-- ============================================
-- TRIGGERS FOR AUTO-UPDATE TIMESTAMPS
-- ============================================

-- Function for kdp_books updated_at
CREATE OR REPLACE FUNCTION update_kdp_books_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public, pg_temp;

-- Trigger for kdp_books
CREATE TRIGGER trigger_kdp_books_updated_at
BEFORE UPDATE ON kdp_books
FOR EACH ROW
EXECUTE FUNCTION update_kdp_books_updated_at();

-- Trigger for users (reuse existing function)
CREATE TRIGGER trigger_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- NOTES
-- ============================================
-- This migration adds:
-- 1. Users table for JWT authentication
-- 2. KDP Books table for storing book metadata
-- 3. KDP Daily Stats for ROI and BSR tracking
-- 4. Journal Events for graph annotations
-- 5. KDP Sync Log for tracking synchronizations
-- 6. RLS policies for security
-- 7. Triggers for auto-updating timestamps
--
-- Run this on Supabase SQL Editor
-- ============================================
