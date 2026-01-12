-- Expand ASIN column from VARCHAR(10) to VARCHAR(15)
-- Some ASINs are 11 characters long (e.g., 0TM9W6BM41J)

ALTER TABLE kdp_books ALTER COLUMN asin TYPE VARCHAR(15);
