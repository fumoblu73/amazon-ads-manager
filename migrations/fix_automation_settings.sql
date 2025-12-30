-- Migration: Fix automation_settings table schema
-- Created: 2025-12-30
-- Removes campaign_id column (settings are per-user, not per-campaign)

-- Drop the old table (it's empty anyway)
DROP TABLE IF EXISTS automation_settings CASCADE;

-- Recreate table with correct schema matching Entity
CREATE TABLE automation_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL UNIQUE,

  -- Funzione 1: Progressive Bidding
  func1_enabled BOOLEAN DEFAULT true,
  func1_bid_increase DECIMAL(10,2) DEFAULT 0.02,
  func1_frequency INTEGER DEFAULT 3,
  func1_impressions INTEGER DEFAULT 20,
  func1_clicks INTEGER DEFAULT 0,

  -- Funzione 2: Placement Optimization
  func2_enabled BOOLEAN DEFAULT true,
  func2_frequency INTEGER DEFAULT 7,
  func2_timeframe_weeks INTEGER DEFAULT 4,

  -- Funzione 3: Targeting Optimization
  func3_enabled BOOLEAN DEFAULT true,
  func3_frequency INTEGER DEFAULT 3,
  func3_timeframe_a INTEGER DEFAULT 2000,
  func3_timeframe_b INTEGER DEFAULT 3000,
  func3_timeframe_c INTEGER DEFAULT 5000,
  func3_clicks_pause INTEGER DEFAULT 10,
  func3_clicks_65days INTEGER DEFAULT 30,

  -- Funzione 4: Auto Ad Optimization
  func4_enabled BOOLEAN DEFAULT true,
  func4_frequency INTEGER DEFAULT 7,
  func4_timeframe_a INTEGER DEFAULT 1000,
  func4_timeframe_b INTEGER DEFAULT 3000,
  func4_timeframe_c INTEGER DEFAULT 5000,
  func4_clicks_negative INTEGER DEFAULT 10,
  func4_spend_negative DECIMAL(10,2) DEFAULT 10,

  -- Funzione 5: Campaign Feeding
  func5_enabled BOOLEAN DEFAULT true,
  func5_frequency INTEGER DEFAULT 7,
  func5_min_orders INTEGER DEFAULT 1,
  func5_bid_broad DECIMAL(10,2) DEFAULT 0.30,
  func5_bid_exact DECIMAL(10,2) DEFAULT 0.50,
  func5_bid_phrase DECIMAL(10,2) DEFAULT 0.40,
  func5_bid_expanded DECIMAL(10,2) DEFAULT 0.30,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Add index on user_id
CREATE INDEX idx_automation_settings_user ON automation_settings(user_id);

-- Verify changes
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'automation_settings'
ORDER BY ordinal_position;
