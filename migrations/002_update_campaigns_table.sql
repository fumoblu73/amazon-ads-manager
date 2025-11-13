-- ================================================
-- MIGRATION: Update Campaigns Table
-- ================================================

-- Aggiungi colonne mancanti se non esistono
DO $$
BEGIN
  -- amazonCampaignId
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='campaigns' AND column_name='amazonCampaignId') THEN
    ALTER TABLE campaigns ADD COLUMN "amazonCampaignId" VARCHAR(100) UNIQUE;
  END IF;

  -- campaignType
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='campaigns' AND column_name='campaignType') THEN
    ALTER TABLE campaigns ADD COLUMN "campaignType" VARCHAR(50);
  END IF;

  -- biddingStrategy
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='campaigns' AND column_name='biddingStrategy') THEN
    ALTER TABLE campaigns ADD COLUMN "biddingStrategy" VARCHAR(50);
  END IF;

  -- notes
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='campaigns' AND column_name='notes') THEN
    ALTER TABLE campaigns ADD COLUMN notes TEXT;
  END IF;

  -- createdAt
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='campaigns' AND column_name='createdAt') THEN
    ALTER TABLE campaigns ADD COLUMN "createdAt" TIMESTAMP DEFAULT NOW();
  END IF;

  -- updatedAt
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='campaigns' AND column_name='updatedAt') THEN
    ALTER TABLE campaigns ADD COLUMN "updatedAt" TIMESTAMP DEFAULT NOW();
  END IF;
END $$;

-- Index per amazonCampaignId
CREATE INDEX IF NOT EXISTS idx_campaigns_amazon_id ON campaigns("amazonCampaignId");
