-- Add updated_at column to journal_events table
ALTER TABLE journal_events ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- Create trigger to automatically update updated_at
CREATE OR REPLACE FUNCTION update_journal_event_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_journal_event_updated_at
BEFORE UPDATE ON journal_events
FOR EACH ROW
EXECUTE FUNCTION update_journal_event_updated_at();
