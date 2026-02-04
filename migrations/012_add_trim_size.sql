-- Add trim_size column to kdp_books table
ALTER TABLE kdp_books ADD COLUMN IF NOT EXISTS trim_size VARCHAR(10) DEFAULT 'regular';
