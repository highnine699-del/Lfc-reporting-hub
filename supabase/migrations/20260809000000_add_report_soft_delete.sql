-- Add soft-delete (archive) support to reports table
-- Archived reports are hidden from normal views but not physically deleted.

ALTER TABLE reports ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ DEFAULT NULL;

-- Index for efficient filtering of non-archived reports
CREATE INDEX IF NOT EXISTS reports_archived_at_idx ON reports (archived_at) WHERE archived_at IS NULL;

-- RLS: allow the owning station's users to archive their own reports
-- (No new policy needed — the existing UPDATE policy for reports already covers this.
--  Archiving is just an UPDATE to set archived_at.)
