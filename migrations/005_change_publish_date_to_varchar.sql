-- Change publish_date from DATE to VARCHAR to store Italian date format
-- (e.g., "26 febbraio 2021" instead of "2021-02-26")
ALTER TABLE kdp_books ALTER COLUMN publish_date TYPE VARCHAR(100);

-- Add comment
COMMENT ON COLUMN kdp_books.publish_date IS 'Publication date in Italian format from KDP (e.g., "26 febbraio 2021")';
