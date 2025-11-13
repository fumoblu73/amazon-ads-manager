-- ================================================
-- MIGRATION: Fix Missing Columns
-- ================================================
-- Questa migration assicura che tutte le colonne
-- snake_case necessarie esistano nelle tabelle

-- Campaigns Table
DO $$
BEGIN
  -- bidding_strategy (snake_case)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='campaigns' AND column_name='bidding_strategy') THEN
    ALTER TABLE campaigns ADD COLUMN bidding_strategy VARCHAR(50);
  END IF;

  -- campaign_type (snake_case)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='campaigns' AND column_name='campaign_type') THEN
    ALTER TABLE campaigns ADD COLUMN campaign_type VARCHAR(50);
  END IF;

  -- amazon_campaign_id (snake_case)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='campaigns' AND column_name='amazon_campaign_id') THEN
    ALTER TABLE campaigns ADD COLUMN amazon_campaign_id VARCHAR(100) UNIQUE;
  END IF;

  -- daily_budget (snake_case)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='campaigns' AND column_name='daily_budget') THEN
    ALTER TABLE campaigns ADD COLUMN daily_budget DECIMAL(10,2);
  END IF;

  -- created_at (snake_case)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='campaigns' AND column_name='created_at') THEN
    ALTER TABLE campaigns ADD COLUMN created_at TIMESTAMP DEFAULT NOW();
  END IF;

  -- updated_at (snake_case)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='campaigns' AND column_name='updated_at') THEN
    ALTER TABLE campaigns ADD COLUMN updated_at TIMESTAMP DEFAULT NOW();
  END IF;
END $$;

-- Automation Logs Table
DO $$
BEGIN
  -- rule_name (snake_case)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='automation_logs' AND column_name='rule_name') THEN
    ALTER TABLE automation_logs ADD COLUMN rule_name VARCHAR(100);
  END IF;

  -- target_id (snake_case)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='automation_logs' AND column_name='target_id') THEN
    ALTER TABLE automation_logs ADD COLUMN target_id VARCHAR(100);
  END IF;

  -- target_name (snake_case)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='automation_logs' AND column_name='target_name') THEN
    ALTER TABLE automation_logs ADD COLUMN target_name VARCHAR(255);
  END IF;

  -- old_value (snake_case)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='automation_logs' AND column_name='old_value') THEN
    ALTER TABLE automation_logs ADD COLUMN old_value DECIMAL(10,2);
  END IF;

  -- new_value (snake_case)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='automation_logs' AND column_name='new_value') THEN
    ALTER TABLE automation_logs ADD COLUMN new_value DECIMAL(10,2);
  END IF;

  -- error_message (snake_case)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='automation_logs' AND column_name='error_message') THEN
    ALTER TABLE automation_logs ADD COLUMN error_message TEXT;
  END IF;

  -- created_at (snake_case)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='automation_logs' AND column_name='created_at') THEN
    ALTER TABLE automation_logs ADD COLUMN created_at TIMESTAMP DEFAULT NOW();
  END IF;
END $$;

-- Books Table (verifica colonne snake_case)
DO $$
BEGIN
  -- printing_cost (snake_case)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='books' AND column_name='printing_cost') THEN
    ALTER TABLE books ADD COLUMN printing_cost DECIMAL(10,2);
  END IF;

  -- royalty_percentage (snake_case)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='books' AND column_name='royalty_percentage') THEN
    ALTER TABLE books ADD COLUMN royalty_percentage DECIMAL(5,2) DEFAULT 60;
  END IF;

  -- fast_acos (snake_case)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='books' AND column_name='fast_acos') THEN
    ALTER TABLE books ADD COLUMN fast_acos DECIMAL(5,2);
  END IF;

  -- created_at (snake_case)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='books' AND column_name='created_at') THEN
    ALTER TABLE books ADD COLUMN created_at TIMESTAMP DEFAULT NOW();
  END IF;

  -- updated_at (snake_case)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='books' AND column_name='updated_at') THEN
    ALTER TABLE books ADD COLUMN updated_at TIMESTAMP DEFAULT NOW();
  END IF;
END $$;

-- Crea indici se non esistono
CREATE INDEX IF NOT EXISTS idx_campaigns_amazon_campaign_id ON campaigns(amazon_campaign_id);
CREATE INDEX IF NOT EXISTS idx_logs_rule_name ON automation_logs(rule_name);
CREATE INDEX IF NOT EXISTS idx_logs_target_id ON automation_logs(target_id);
CREATE INDEX IF NOT EXISTS idx_logs_created_at ON automation_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_books_asin ON books(asin);
