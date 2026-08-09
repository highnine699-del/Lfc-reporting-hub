-- Enforce admin-only write access to template tables.
-- Previously the INSERT/UPDATE policies used `auth.uid() IS NOT NULL`
-- (any authenticated user). This migration replaces them with a check
-- against the users.role column.

-- ── templates ──────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Authenticated users can create templates" ON templates;
DROP POLICY IF EXISTS "Authenticated users can update templates" ON templates;

CREATE POLICY "Admins can insert templates"
  ON templates FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can update templates"
  ON templates FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role = 'admin'
    )
  );

-- ── template_versions ──────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Authenticated users can create template versions" ON template_versions;

CREATE POLICY "Admins can insert template versions"
  ON template_versions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role = 'admin'
    )
  );

-- ── template_field_mappings ────────────────────────────────────────────────

DROP POLICY IF EXISTS "Authenticated users can create template field mappings" ON template_field_mappings;

CREATE POLICY "Admins can insert template field mappings"
  ON template_field_mappings FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role = 'admin'
    )
  );

-- Read policies remain open to all authenticated users (unchanged).
