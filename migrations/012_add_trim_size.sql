-- Add trim_size column to kdp_books table
-- Values: '5x8', '6x9' (Regular), '8x10', '8.5x8.5', '8.5x11' (Large)
-- Default: '6x9' (most common KDP format)

ALTER TABLE kdp_books ADD COLUMN IF NOT EXISTS trim_size VARCHAR(10) DEFAULT '6x9';

-- Update any existing 'regular' values to '6x9' and 'large' to '8.5x11'
UPDATE kdp_books SET trim_size = '6x9' WHERE trim_size = 'regular' OR trim_size IS NULL;
UPDATE kdp_books SET trim_size = '8.5x11' WHERE trim_size = 'large';
