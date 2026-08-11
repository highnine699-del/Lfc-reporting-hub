-- Add free-text notes column to service_entries
ALTER TABLE service_entries
  ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT NULL;
