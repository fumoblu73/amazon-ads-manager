-- Add format field for book format (eBook, Paperback, Hardcover, etc.)
ALTER TABLE kdp_books ADD COLUMN IF NOT EXISTS format VARCHAR(50);

-- Add BSR (Best Sellers Rank) fields for Amazon.com ranking
ALTER TABLE kdp_books ADD COLUMN IF NOT EXISTS bsr_rank INTEGER;
ALTER TABLE kdp_books ADD COLUMN IF NOT EXISTS bsr_category VARCHAR(100);

-- Add comment to explain fields
COMMENT ON COLUMN kdp_books.format IS 'Book format: eBook Kindle, Versione cartacea, Copertina rigida, etc.';
COMMENT ON COLUMN kdp_books.bsr_rank IS 'Best Sellers Rank number from Amazon.com';
COMMENT ON COLUMN kdp_books.bsr_category IS 'BSR category name from Amazon.com';
