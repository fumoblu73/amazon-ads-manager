-- Migration: Create automation_settings table
-- Created: 2025-12-29

CREATE TABLE IF NOT EXISTS automation_settings (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  campaign_id VARCHAR(255) NOT NULL,

  -- Funzione 1: Progressive Bidding
  func1_enabled BOOLEAN DEFAULT true,
  func1_bid_increase DECIMAL(5,2) DEFAULT 0.02,
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
  func4_spend_negative INTEGER DEFAULT 10,

  -- Funzione 5: Campaign Feeding
  func5_enabled BOOLEAN DEFAULT true,
  func5_frequency INTEGER DEFAULT 7,
  func5_min_orders INTEGER DEFAULT 1,
  func5_bid_broad DECIMAL(5,2) DEFAULT 0.30,
  func5_bid_exact DECIMAL(5,2) DEFAULT 0.50,
  func5_bid_phrase DECIMAL(5,2) DEFAULT 0.40,
  func5_bid_expanded DECIMAL(5,2) DEFAULT 0.30,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(user_id, campaign_id)
);

-- Add indexes (conditional: columns may not exist if table was created by a different migration)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name='automation_settings' AND column_name='user_id') THEN
    CREATE INDEX IF NOT EXISTS idx_automation_settings_user ON automation_settings(user_id);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name='automation_settings' AND column_name='campaign_id') THEN
    CREATE INDEX IF NOT EXISTS idx_automation_settings_campaign ON automation_settings(campaign_id);
  END IF;
END $$;

-- Verify table created
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_name = 'automation_settings'
ORDER BY ordinal_position
LIMIT 10;
