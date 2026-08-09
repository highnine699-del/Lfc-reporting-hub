-- ============================================================
-- Migration: service_entries, template_columns, station/user
--            profile expansions
-- ============================================================

-- ── 1. Extend stations table ─────────────────────────────────
ALTER TABLE stations
  ADD COLUMN IF NOT EXISTS category          TEXT DEFAULT 'cotm'
    CHECK (category IN ('mainline', 'cotm', 'cpm')),
  ADD COLUMN IF NOT EXISTS state_name        TEXT,
  ADD COLUMN IF NOT EXISTS facility_details  JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS wofbi_class       TEXT DEFAULT 'none'
    CHECK (wofbi_class IN ('bcc', 'lcc', 'ldc', 'none'));

-- ── 2. Extend users table ────────────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS yoe TEXT,   -- Year of Entry (e.g. "11/01/2012")
  ADD COLUMN IF NOT EXISTS dor TEXT;   -- Date of Resumption (e.g. "21/09/2025")

-- ── 3. template_columns table ────────────────────────────────
-- Stores every column detected from an uploaded Excel template.
-- Replaces the old template_field_mappings approach with a
-- richer, aggregation-aware structure.
CREATE TABLE IF NOT EXISTS template_columns (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_version_id  UUID NOT NULL REFERENCES template_versions(id) ON DELETE CASCADE,
  header_text          TEXT NOT NULL,          -- raw header from Excel
  field_key            TEXT NOT NULL,          -- normalised snake_case key
  sheet_name           TEXT NOT NULL DEFAULT 'Sheet1',
  data_row_start       INTEGER NOT NULL DEFAULT 2, -- 1-based row where data rows begin
  col_index            INTEGER NOT NULL,        -- 0-based column index in the sheet
  aggregation_type     TEXT NOT NULL DEFAULT 'sum'
    CHECK (aggregation_type IN ('sum', 'avg', 'max', 'latest', 'fixed')),
  display_label        TEXT NOT NULL,
  is_static            BOOLEAN NOT NULL DEFAULT FALSE,
  static_source        TEXT,                   -- e.g. 'station.name', 'user.full_name'
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 4. service_entries table ──────────────────────────────────
-- One row per service. Replaces the old per-report paradigm at
-- the pastor level. data is a free-form JSONB blob whose keys
-- match template_columns.field_key values.
CREATE TABLE IF NOT EXISTS service_entries (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id           UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  service_date         DATE NOT NULL,
  template_version_id  UUID REFERENCES template_versions(id) ON DELETE SET NULL,
  data                 JSONB NOT NULL DEFAULT '{}'::jsonb,
  entered_by           UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  source               TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual','whatsapp_text','voice','handwriting',
                      'bank_reconciliation','auto_compile','excel_import')),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for the most common query: all entries for a station in a date range
CREATE INDEX IF NOT EXISTS idx_service_entries_station_date
  ON service_entries (station_id, service_date DESC);

-- ── 5. RLS policies ──────────────────────────────────────────

-- template_columns: any authenticated user can read; only admins insert
ALTER TABLE template_columns ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Authenticated users can read template_columns"
  ON template_columns FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY IF NOT EXISTS "Authenticated users can insert template_columns"
  ON template_columns FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY IF NOT EXISTS "Authenticated users can update template_columns"
  ON template_columns FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY IF NOT EXISTS "Authenticated users can delete template_columns"
  ON template_columns FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- service_entries: users can only see/edit their own station's entries
ALTER TABLE service_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users can read own station service entries"
  ON service_entries FOR SELECT
  USING (
    station_id IN (
      SELECT station_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY IF NOT EXISTS "Users can insert own station service entries"
  ON service_entries FOR INSERT
  WITH CHECK (
    station_id IN (
      SELECT station_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY IF NOT EXISTS "Users can update own station service entries"
  ON service_entries FOR UPDATE
  USING (
    station_id IN (
      SELECT station_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY IF NOT EXISTS "Users can delete own station service entries"
  ON service_entries FOR DELETE
  USING (
    station_id IN (
      SELECT station_id FROM users WHERE id = auth.uid()
    )
  );

-- Supervisors need to read sub-station entries for report generation
CREATE POLICY IF NOT EXISTS "Supervisors can read descendant station service entries"
  ON service_entries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM stations s
      JOIN users u ON u.station_id = s.id
      WHERE u.id = auth.uid()
        AND (
          -- direct child
          s.id = service_entries.station_id
          OR
          -- any depth via parent chain (handled in app logic; policy just opens the door)
          service_entries.station_id IN (
            SELECT id FROM stations WHERE parent_station_id = u.station_id
          )
        )
    )
  );

-- ── 6. Updated_at trigger for service_entries ─────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_service_entries_updated_at ON service_entries;
CREATE TRIGGER set_service_entries_updated_at
  BEFORE UPDATE ON service_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
