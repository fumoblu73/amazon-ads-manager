-- Migration 014: Add royalty_per_unit to kdp_books
-- Stores the net royalty per unit sold (price * rate - printing_cost)
-- Populated by extension when scraping KDP pricing page per book

ALTER TABLE kdp_books ADD COLUMN IF NOT EXISTS royalty_per_unit DECIMAL(10,4);
