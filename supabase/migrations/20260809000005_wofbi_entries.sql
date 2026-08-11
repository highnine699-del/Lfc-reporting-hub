-- ============================================================
-- Migration: wofbi_entries table
-- Tracks monthly Bible school attendance per station per class.
-- Separate from service_entries because WOFBI runs on a
-- monthly cycle independent of regular Sunday services.
-- ============================================================

CREATE TABLE IF NOT EXISTS wofbi_entries (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id   UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  month        DATE NOT NULL,          -- always the 1st of the month
  wofbi_class  TEXT NOT NULL
    CHECK (wofbi_class IN ('bcc', 'lcc', 'ldc')),
  attendance   INTEGER NOT NULL DEFAULT 0 CHECK (attendance >= 0),
  notes        TEXT,
  entered_by   UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at   TIMESTAMPTZ DEFAULT NULL,
  UNIQUE (station_id, month, wofbi_class)   -- one entry per class per month per station
);

CREATE INDEX IF NOT EXISTS idx_wofbi_entries_station_month
  ON wofbi_entries (station_id, month DESC)
  WHERE deleted_at IS NULL;

-- updated_at trigger
DROP TRIGGER IF EXISTS set_wofbi_entries_updated_at ON wofbi_entries;
CREATE TRIGGER set_wofbi_entries_updated_at
  BEFORE UPDATE ON wofbi_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE wofbi_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own station wofbi entries" ON wofbi_entries;
DROP POLICY IF EXISTS "Users can insert own station wofbi entries" ON wofbi_entries;
DROP POLICY IF EXISTS "Users can update own station wofbi entries" ON wofbi_entries;
DROP POLICY IF EXISTS "Supervisors can read descendant wofbi entries" ON wofbi_entries;

CREATE POLICY "Users can read own station wofbi entries"
  ON wofbi_entries FOR SELECT
  USING (
    station_id IN (SELECT station_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Users can insert own station wofbi entries"
  ON wofbi_entries FOR INSERT
  WITH CHECK (
    station_id IN (SELECT station_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Users can update own station wofbi entries"
  ON wofbi_entries FOR UPDATE
  USING (
    station_id IN (SELECT station_id FROM users WHERE id = auth.uid())
  );

-- Supervisors read descendant wofbi entries (same recursive pattern)
CREATE POLICY "Supervisors can read descendant wofbi entries"
  ON wofbi_entries FOR SELECT
  USING (
    EXISTS (
      WITH RECURSIVE subtree AS (
        SELECT s.id FROM stations s
        JOIN users u ON u.station_id = s.id
        WHERE u.id = auth.uid()
        UNION ALL
        SELECT s2.id FROM stations s2
        JOIN subtree st ON s2.parent_station_id = st.id
      )
      SELECT 1 FROM subtree WHERE subtree.id = wofbi_entries.station_id
    )
  );
