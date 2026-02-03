-- Migration: Add VAT settings to automation_settings
-- Date: 2026-02-03

-- Add VAT settings for FAST ACOS calculation
ALTER TABLE automation_settings
ADD COLUMN IF NOT EXISTS use_vat_in_fast_acos BOOLEAN DEFAULT true;

ALTER TABLE automation_settings
ADD COLUMN IF NOT EXISTS vat_percentage DECIMAL(5,2) DEFAULT 22;

-- Update existing rows to have default values
UPDATE automation_settings
SET use_vat_in_fast_acos = true, vat_percentage = 22
WHERE use_vat_in_fast_acos IS NULL;
