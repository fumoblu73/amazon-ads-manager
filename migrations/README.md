# Database Migrations

Queste migration SQL devono essere eseguite su Supabase per creare/aggiornare le tabelle necessarie.

## 🚀 Come Applicare le Migration

### 1. Accedi a Supabase Dashboard
```
https://app.supabase.com
```

### 2. Seleziona il tuo progetto
- Vai al tuo progetto Amazon Ads Manager

### 3. Apri SQL Editor
- Nel menu laterale, clicca su **"SQL Editor"**

### 4. Esegui le migration in ordine

#### Migration 001: Create Books Table
```sql
-- Copia e incolla il contenuto di 001_create_books_table.sql
-- Poi clicca "Run" o premi Ctrl+Enter
```

#### Migration 002: Update Campaigns Table
```sql
-- Copia e incolla il contenuto di 002_update_campaigns_table.sql
-- Poi clicca "Run" o premi Ctrl+Enter
```

#### Migration 003: Update Automation Logs Table
```sql
-- Copia e incolla il contenuto di 003_update_automation_logs_table.sql
-- Poi clicca "Run" o premi Ctrl+Enter
```

#### Migration 004: Fix Missing Columns (IMPORTANTE!)
```sql
-- Copia e incolla il contenuto di 004_fix_missing_columns.sql
-- Poi clicca "Run" o premi Ctrl+Enter
-- Questa migration assicura che tutte le colonne snake_case esistano
```

### 5. Verifica le tabelle
```sql
-- Verifica che le tabelle esistano
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Verifica colonne books
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'books';

-- Verifica colonne campaigns
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'campaigns';

-- Verifica colonne automation_logs
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'automation_logs';
```

## ✅ Dopo le Migration

Una volta applicate le migration, riavvia il servizio su Render.com:
- Le API `/api/books`, `/api/campaigns`, `/api/logs` funzioneranno correttamente

## 📊 Struttura Tabelle

### books
- `id` - UUID (PK)
- `asin` - VARCHAR(10) UNIQUE
- `title` - VARCHAR(255)
- `price` - DECIMAL(10,2)
- `printingCost` - DECIMAL(10,2)
- `royaltyPercentage` - DECIMAL(5,2) DEFAULT 60
- `fastAcos` - DECIMAL(5,2)
- `marketplace` - VARCHAR(10)
- `createdAt`, `updatedAt` - TIMESTAMP

### campaigns (colonne aggiunte)
- `amazonCampaignId` - VARCHAR(100) UNIQUE
- `campaignType` - VARCHAR(50)
- `biddingStrategy` - VARCHAR(50)
- `notes` - TEXT
- `createdAt`, `updatedAt` - TIMESTAMP

### automation_logs (colonne aggiunte)
- `targetId` - VARCHAR(100)
- `targetName` - VARCHAR(255)
- `oldValue` - DECIMAL(10,2)
- `newValue` - DECIMAL(10,2)
- `reason` - TEXT
- `ruleName` - VARCHAR(100)
- `errorMessage` - TEXT

## 🔄 Rollback (se necessario)

Se qualcosa va storto:

```sql
-- Rimuovi tabella books
DROP TABLE IF EXISTS books CASCADE;

-- Rimuovi colonne aggiunte a campaigns
ALTER TABLE campaigns
  DROP COLUMN IF EXISTS "amazonCampaignId",
  DROP COLUMN IF EXISTS "campaignType",
  DROP COLUMN IF EXISTS "biddingStrategy",
  DROP COLUMN IF EXISTS notes,
  DROP COLUMN IF EXISTS "createdAt",
  DROP COLUMN IF EXISTS "updatedAt";

-- Rimuovi colonne aggiunte a automation_logs
ALTER TABLE automation_logs
  DROP COLUMN IF EXISTS "targetId",
  DROP COLUMN IF EXISTS "targetName",
  DROP COLUMN IF EXISTS "oldValue",
  DROP COLUMN IF EXISTS "newValue",
  DROP COLUMN IF EXISTS reason,
  DROP COLUMN IF EXISTS "ruleName",
  DROP COLUMN IF EXISTS "errorMessage";
```
