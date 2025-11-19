-- ================================================
-- MIGRATION: Create Automation Config Table
-- ================================================
-- Tabella per gestire la configurazione delle automazioni
-- per ogni campagna (funzioni 1-5)

CREATE TABLE IF NOT EXISTS automation_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL,
  book_id UUID,

  -- ================================================
  -- FUNZIONE 1: Progressive Bidding Increase
  -- ================================================
  func1_enabled BOOLEAN DEFAULT TRUE,
  func1_bid_increase DECIMAL(5,2) DEFAULT 0.02,
  func1_frequency INTEGER DEFAULT 3,
  func1_impressions INTEGER DEFAULT 20,
  func1_clicks INTEGER DEFAULT 0,

  -- ================================================
  -- FUNZIONE 2: Placement Optimization
  -- ================================================
  func2_enabled BOOLEAN DEFAULT TRUE,
  func2_frequency INTEGER DEFAULT 7,
  func2_timeframe_weeks INTEGER DEFAULT 4,

  -- ================================================
  -- FUNZIONE 3: Targeting Optimization
  -- ================================================
  func3_enabled BOOLEAN DEFAULT TRUE,
  func3_frequency INTEGER DEFAULT 3,
  func3_timeframe_a INTEGER DEFAULT 2000,
  func3_timeframe_b INTEGER DEFAULT 3000,
  func3_timeframe_c INTEGER DEFAULT 5000,
  func3_clicks_pause INTEGER DEFAULT 10,
  func3_clicks_65days INTEGER DEFAULT 30,

  -- ================================================
  -- FUNZIONE 4: Auto Ad Optimization
  -- ================================================
  func4_enabled BOOLEAN DEFAULT TRUE,
  func4_frequency INTEGER DEFAULT 7,
  func4_timeframe_a INTEGER DEFAULT 1000,
  func4_timeframe_b INTEGER DEFAULT 3000,
  func4_timeframe_c INTEGER DEFAULT 5000,
  func4_clicks_negative INTEGER DEFAULT 10,
  func4_spend_negative DECIMAL(10,2) DEFAULT 10.00,

  -- ================================================
  -- FUNZIONE 5: Campaign Feeding
  -- ================================================
  func5_enabled BOOLEAN DEFAULT TRUE,
  func5_frequency INTEGER DEFAULT 7,
  func5_min_orders INTEGER DEFAULT 1,
  func5_bid_broad DECIMAL(5,2) DEFAULT 0.30,
  func5_bid_exact DECIMAL(5,2) DEFAULT 0.50,
  func5_bid_phrase DECIMAL(5,2) DEFAULT 0.40,
  func5_bid_expanded DECIMAL(5,2) DEFAULT 0.30,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Foreign key constraints
  CONSTRAINT fk_automation_config_campaign
    FOREIGN KEY (campaign_id)
    REFERENCES campaigns(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_automation_config_book
    FOREIGN KEY (book_id)
    REFERENCES books(id)
    ON DELETE SET NULL,

  -- Un solo config per campagna
  CONSTRAINT unique_campaign_config UNIQUE (campaign_id)
);

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_automation_config_campaign_id ON automation_config(campaign_id);
CREATE INDEX IF NOT EXISTS idx_automation_config_book_id ON automation_config(book_id);

-- Trigger per aggiornare updated_at automaticamente
CREATE OR REPLACE FUNCTION update_automation_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_automation_config_updated_at
  BEFORE UPDATE ON automation_config
  FOR EACH ROW
  EXECUTE FUNCTION update_automation_config_updated_at();

-- Commento sulla tabella
COMMENT ON TABLE automation_config IS 'Configurazione delle 5 funzioni di ottimizzazione per ogni campagna';
