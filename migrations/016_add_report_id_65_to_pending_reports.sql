-- Migration 016: Add 65-day report IDs to pending_reports
-- These columns store the Amazon report IDs for the two 65-day chunks used by F3.
-- Chunk A: last 30 days | Chunk B: days 31-65
ALTER TABLE pending_reports
  ADD COLUMN IF NOT EXISTS report_id_65a VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS report_id_65b VARCHAR(255) NULL;
