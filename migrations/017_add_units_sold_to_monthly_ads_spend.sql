ALTER TABLE monthly_ads_spend
  ADD COLUMN IF NOT EXISTS total_units_sold INTEGER DEFAULT 0;
