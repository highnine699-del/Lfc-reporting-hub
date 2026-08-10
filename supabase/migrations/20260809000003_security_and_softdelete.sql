-- ============================================================
-- Migration: security hardening + soft-delete + RLS fixes
-- ============================================================

-- ── 1. Soft-delete column on service_entries ─────────────────
ALTER TABLE service_entries
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_service_entries_not_deleted
  ON service_entries (station_id, service_date DESC)
  WHERE deleted_at IS NULL;

-- ── 2. template_columns — drop permissive policies, add admin-only write ──
ALTER TABLE template_columns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read template_columns"   ON template_columns;
DROP POLICY IF EXISTS "Authenticated users can insert template_columns"  ON template_columns;
DROP POLICY IF EXISTS "Authenticated users can update template_columns"  ON template_columns;
DROP POLICY IF EXISTS "Authenticated users can delete template_columns"  ON template_columns;

-- Anyone authenticated can read (pastors need columns to render entry forms)
CREATE POLICY "Anyone can read template_columns"
  ON template_columns FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Only admins can write
CREATE POLICY "Admins can insert template_columns"
  ON template_columns FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update template_columns"
  ON template_columns FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete template_columns"
  ON template_columns FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ── 3. service_entries — drop old policies, add corrected ones ──
ALTER TABLE service_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own station service entries"                   ON service_entries;
DROP POLICY IF EXISTS "Users can insert own station service entries"                 ON service_entries;
DROP POLICY IF EXISTS "Users can update own station service entries"                 ON service_entries;
DROP POLICY IF EXISTS "Users can delete own station service entries"                 ON service_entries;
DROP POLICY IF EXISTS "Supervisors can read descendant station service entries"      ON service_entries;

-- Own station: full CRUD
CREATE POLICY "Users can read own station service entries"
  ON service_entries FOR SELECT
  USING (
    station_id IN (
      SELECT station_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own station service entries"
  ON service_entries FOR INSERT
  WITH CHECK (
    station_id IN (
      SELECT station_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update own station service entries"
  ON service_entries FOR UPDATE
  USING (
    station_id IN (
      SELECT station_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own station service entries"
  ON service_entries FOR DELETE
  USING (
    station_id IN (
      SELECT station_id FROM users WHERE id = auth.uid()
    )
  );

-- ── 4. Supervisor read policy — recursive descendant tree ────
-- Uses a recursive CTE so a state-level supervisor can read entries
-- from any depth of sub-station (community → area → zonal → … → state).
CREATE POLICY "Supervisors can read descendant service entries"
  ON service_entries FOR SELECT
  USING (
    EXISTS (
      WITH RECURSIVE subtree AS (
        -- Start: the supervisor's own station
        SELECT s.id
        FROM stations s
        JOIN users u ON u.station_id = s.id
        WHERE u.id = auth.uid()

        UNION ALL

        -- Recurse: all children of stations already in the tree
        SELECT s2.id
        FROM stations s2
        JOIN subtree st ON s2.parent_station_id = st.id
      )
      SELECT 1 FROM subtree WHERE subtree.id = service_entries.station_id
    )
  );

-- ── 5. template_versions — open read to all authenticated ────
ALTER TABLE template_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read template_versions" ON template_versions;
DROP POLICY IF EXISTS "Admins can insert template_versions"            ON template_versions;
DROP POLICY IF EXISTS "Admins can update template_versions"            ON template_versions;

CREATE POLICY "Authenticated users can read template_versions"
  ON template_versions FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can insert template_versions"
  ON template_versions FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can update template_versions"
  ON template_versions FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );
