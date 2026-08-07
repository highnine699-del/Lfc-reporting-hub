-- Migration to sync local schema with live database changes
-- These changes were made directly in SQL Editor and need to be captured in migrations

-- 1. Add status and finalized_at fields to reports table
ALTER TABLE reports ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'finalized', 'submitted'));
ALTER TABLE reports ADD COLUMN IF NOT EXISTS finalized_at TIMESTAMPTZ;

-- 2. Make template_id nullable in reports table
ALTER TABLE reports ALTER COLUMN template_id DROP NOT NULL;

-- 3. Make template_version_id nullable in report_versions table  
ALTER TABLE report_versions ALTER COLUMN template_version_id DROP NOT NULL;

-- 4. Add RLS policy for templates SELECT (if not exists)
CREATE POLICY IF NOT EXISTS "Authenticated users can read templates"
  ON templates FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- 5. Add RLS policy for template_field_mappings INSERT (if not exists)
CREATE POLICY IF NOT EXISTS "Authenticated users can create template field mappings"
  ON template_field_mappings FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- 6. Add RLS policy for template_field_mappings SELECT (if not exists)
CREATE POLICY IF NOT EXISTS "Authenticated users can read template field mappings"
  ON template_field_mappings FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- 7. Add RLS policy for template_versions INSERT (if not exists)
CREATE POLICY IF NOT EXISTS "Authenticated users can create template versions"
  ON template_versions FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- 8. Add RLS policy for template_versions SELECT (if not exists)
CREATE POLICY IF NOT EXISTS "Authenticated users can read template versions"
  ON template_versions FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- 9. Create generated-reports storage bucket (if not exists)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('generated-reports', 'generated-reports', false) 
ON CONFLICT (id) DO NOTHING;

-- 10. Add RLS policy for generated-reports storage upload (if not exists)
CREATE POLICY IF NOT EXISTS "Authenticated users can upload generated reports"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'generated-reports' AND auth.uid() IS NOT NULL);

-- 11. Add RLS policy for generated-reports storage read (if not exists)
CREATE POLICY IF NOT EXISTS "Authenticated users can read generated reports"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'generated-reports' AND auth.uid() IS NOT NULL);

-- 12. Fix stations INSERT policy to allow returning data (if not exists)
DROP POLICY IF EXISTS "Users can create stations for their station" ON stations;
CREATE POLICY IF NOT EXISTS "Users can create stations for their station"
  ON stations FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() AND users.station_id IS NULL
    )
  )
  RETURNING (SELECT * FROM stations WHERE id = (SELECT id FROM stations ORDER BY created_at DESC LIMIT 1));