-- ================================================
-- MIGRATION: Create Books Table
-- ================================================

CREATE TABLE IF NOT EXISTS books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asin VARCHAR(10) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  "printingCost" DECIMAL(10,2) NOT NULL,
  "royaltyPercentage" DECIMAL(5,2) DEFAULT 60,
  "fastAcos" DECIMAL(5,2) NOT NULL,
  marketplace VARCHAR(10) NOT NULL,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- Index per ricerche veloci
CREATE INDEX IF NOT EXISTS idx_books_asin ON books(asin);
CREATE INDEX IF NOT EXISTS idx_books_marketplace ON books(marketplace);

-- Commento tabella
COMMENT ON TABLE books IS 'Libri con calcolo FAST ACoS automatico';
