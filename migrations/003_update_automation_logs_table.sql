-- ================================================
-- MIGRATION: Update Automation Logs Table
-- ================================================

-- Aggiungi colonne mancanti se non esistono
DO $$
BEGIN
  -- targetId
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='automation_logs' AND column_name='targetId') THEN
    ALTER TABLE automation_logs ADD COLUMN "targetId" VARCHAR(100);
  END IF;

  -- targetName
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='automation_logs' AND column_name='targetName') THEN
    ALTER TABLE automation_logs ADD COLUMN "targetName" VARCHAR(255);
  END IF;

  -- oldValue
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='automation_logs' AND column_name='oldValue') THEN
    ALTER TABLE automation_logs ADD COLUMN "oldValue" DECIMAL(10,2);
  END IF;

  -- newValue
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='automation_logs' AND column_name='newValue') THEN
    ALTER TABLE automation_logs ADD COLUMN "newValue" DECIMAL(10,2);
  END IF;

  -- reason
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='automation_logs' AND column_name='reason') THEN
    ALTER TABLE automation_logs ADD COLUMN reason TEXT;
  END IF;

  -- ruleName
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='automation_logs' AND column_name='ruleName') THEN
    ALTER TABLE automation_logs ADD COLUMN "ruleName" VARCHAR(100);
  END IF;

  -- errorMessage
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='automation_logs' AND column_name='errorMessage') THEN
    ALTER TABLE automation_logs ADD COLUMN "errorMessage" TEXT;
  END IF;
END $$;

-- Index per query filtrate
CREATE INDEX IF NOT EXISTS idx_logs_target_id ON automation_logs("targetId");
CREATE INDEX IF NOT EXISTS idx_logs_rule_name ON automation_logs("ruleName");
CREATE INDEX IF NOT EXISTS idx_logs_created_at ON automation_logs(created_at);
