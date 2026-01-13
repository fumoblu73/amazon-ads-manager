-- Add price field for paperback price
ALTER TABLE kdp_books ADD COLUMN IF NOT EXISTS price VARCHAR(50);

-- Add comment
COMMENT ON COLUMN kdp_books.price IS 'Paperback price from KDP (e.g., $23,99 USD)';
