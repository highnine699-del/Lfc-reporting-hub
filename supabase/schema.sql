-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- 
-- Enable pg_cron extension for scheduled jobs
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- Create stations table
CREATE TABLE IF NOT EXISTS stations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('community', 'area', 'zonal', 'district', 'state', 'headquarters')),
  parent_station_id UUID REFERENCES stations(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create users table (extends auth.users)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('pastor', 'delegate', 'admin')),
  full_name TEXT NOT NULL,
  staff_id TEXT,
  phone_number TEXT,
  station_id UUID NOT NULL REFERENCES stations(id),
  linked_pastor_id UUID REFERENCES users(id),
  subscription_status TEXT NOT NULL DEFAULT 'trial' CHECK (subscription_status IN ('trial', 'active', 'expired')),
  trial_ends_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '1 month',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create delegate_pairing_codes table
CREATE TABLE IF NOT EXISTS delegate_pairing_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pastor_id UUID NOT NULL REFERENCES users(id),
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '10 minutes',
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create templates table
CREATE TABLE IF NOT EXISTS templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  period_type TEXT NOT NULL CHECK (period_type IN ('weekly', 'monthly', 'quarterly', 'half_year', 'yearly')),
  current_version_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create template_versions table
CREATE TABLE IF NOT EXISTS template_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id UUID NOT NULL REFERENCES templates(id),
  file_storage_path TEXT NOT NULL,
  version_number INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create template_field_mappings table
CREATE TABLE IF NOT EXISTS template_field_mappings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_version_id UUID NOT NULL REFERENCES template_versions(id),
  sheet_name TEXT NOT NULL DEFAULT 'Sheet1',
  cell_reference TEXT NOT NULL,
  data_field_key TEXT NOT NULL,
  label_text TEXT NOT NULL
);

-- Create data_fields table (canonical field registry)
CREATE TABLE IF NOT EXISTS data_fields (
  key TEXT PRIMARY KEY,
  category TEXT NOT NULL CHECK (category IN ('attendance', 'spiritual', 'finance_income', 'finance_expenditure', 'bank')),
  display_name TEXT NOT NULL,
  data_type TEXT NOT NULL CHECK (data_type IN ('number', 'currency', 'text'))
);

-- Seed data_fields with canonical fields from specification
INSERT INTO data_fields (key, category, display_name, data_type) VALUES
-- Attendance
('adults_male_attendance', 'attendance', 'Adult Male Attendance', 'number'),
('adults_female_attendance', 'attendance', 'Adult Female Attendance', 'number'),
('children_male_attendance', 'attendance', 'Children Male Attendance', 'number'),
('children_female_attendance', 'attendance', 'Children Female Attendance', 'number'),
('children_attendance', 'attendance', 'Children Attendance (Combined)', 'number'),
('first_timers', 'attendance', 'First Timers', 'number'),
('new_converts', 'attendance', 'New Converts', 'number'),
-- Spiritual
('testimonies', 'spiritual', 'Testimonies', 'number'),
('altar_calls', 'spiritual', 'Altar Calls', 'number'),
('wofbi_attendance', 'spiritual', 'WOFBI Attendance', 'number'),
('water_baptisms', 'spiritual', 'Water Baptisms', 'number'),
('holy_ghost_baptisms', 'spiritual', 'Holy Ghost Baptisms', 'number'),
-- Finance Income
('tithes', 'finance_income', 'Tithes', 'currency'),
('offerings', 'finance_income', 'Offerings', 'currency'),
('thanksgiving', 'finance_income', 'Thanksgiving/Special Offering', 'currency'),
('kcc', 'finance_income', 'KCC', 'currency'),
('shiloh_sacrifice', 'finance_income', 'Shiloh Sacrifice', 'currency'),
('project_funds', 'finance_income', 'Project Funds', 'currency')
ON CONFLICT (key) DO NOTHING;

-- Create expenditure_categories table
CREATE TABLE IF NOT EXISTS expenditure_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  station_id UUID NOT NULL REFERENCES stations(id),
  name TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create reports table
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  station_id UUID NOT NULL REFERENCES stations(id),
  template_id UUID NOT NULL REFERENCES templates(id),
  period_type TEXT NOT NULL CHECK (period_type IN ('weekly', 'monthly', 'quarterly', 'half_year', 'yearly')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  current_version_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create report_versions table
CREATE TABLE IF NOT EXISTS report_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_id UUID NOT NULL REFERENCES reports(id),
  template_version_id UUID NOT NULL REFERENCES template_versions(id),
  data JSONB NOT NULL,
  edited_by UUID NOT NULL REFERENCES users(id),
  server_timestamp TIMESTAMPTZ DEFAULT NOW(),
  source TEXT NOT NULL CHECK (source IN ('manual', 'whatsapp_text', 'voice', 'handwriting', 'bank_reconciliation', 'auto_compile')),
  generated_file_path TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create bank_statements table
CREATE TABLE IF NOT EXISTS bank_statements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  station_id UUID NOT NULL REFERENCES stations(id),
  file_storage_path TEXT NOT NULL,
  ocr_raw_text TEXT,
  parsed_total NUMERIC,
  linked_report_version_id UUID REFERENCES report_versions(id),
  confirmed_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create discrepancy_flags table
CREATE TABLE IF NOT EXISTS discrepancy_flags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_version_id UUID NOT NULL REFERENCES report_versions(id),
  bank_statement_id UUID NOT NULL REFERENCES bank_statements(id),
  reported_total NUMERIC NOT NULL,
  bank_total NUMERIC NOT NULL,
  difference NUMERIC NOT NULL,
  resolved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE delegate_pairing_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_field_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenditure_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE discrepancy_flags ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- stations: readable by users whose station_id matches
CREATE POLICY "Users can view their own station"
  ON stations FOR SELECT
  USING (id IN (SELECT station_id FROM users WHERE id = auth.uid()));

-- stations: authenticated users can create a station (for onboarding)
CREATE POLICY "Authenticated users can create a station"
  ON stations FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- users: users can read/update only their own row
CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  USING (id = auth.uid());

-- users: authenticated users can insert their own profile (for onboarding)
CREATE POLICY "Users can insert own profile"
  ON users FOR INSERT
  WITH CHECK (id = auth.uid());

-- pastors can read rows of delegates linked to them
CREATE POLICY "Pastors can view their delegates"
  ON users FOR SELECT
  USING (linked_pastor_id IN (SELECT id FROM users WHERE id = auth.uid()));

-- delegate_pairing_codes: only the owning pastor can read/create their own codes
CREATE POLICY "Pastors can view their pairing codes"
  ON delegate_pairing_codes FOR SELECT
  USING (pastor_id = auth.uid());

CREATE POLICY "Pastors can create pairing codes"
  ON delegate_pairing_codes FOR INSERT
  WITH CHECK (pastor_id = auth.uid());

CREATE POLICY "Pastors can update their pairing codes"
  ON delegate_pairing_codes FOR UPDATE
  USING (pastor_id = auth.uid());

-- templates: readable by all authenticated users
CREATE POLICY "Authenticated users can view templates"
  ON templates FOR SELECT
  USING (auth.role() = 'authenticated');

-- template_versions: readable by all authenticated users
CREATE POLICY "Authenticated users can view template versions"
  ON template_versions FOR SELECT
  USING (auth.role() = 'authenticated');

-- template_field_mappings: readable by all authenticated users
CREATE POLICY "Authenticated users can view field mappings"
  ON template_field_mappings FOR SELECT
  USING (auth.role() = 'authenticated');

-- data_fields: readable by all authenticated users
CREATE POLICY "Authenticated users can view data fields"
  ON data_fields FOR SELECT
  USING (auth.role() = 'authenticated');

-- expenditure_categories: users can read/create for their station
CREATE POLICY "Users can view expenditure categories for their station"
  ON expenditure_categories FOR SELECT
  USING (station_id IN (SELECT station_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can create expenditure categories for their station"
  ON expenditure_categories FOR INSERT
  WITH CHECK (
    station_id IN (SELECT station_id FROM users WHERE id = auth.uid()) AND
    created_by = auth.uid()
  );

-- reports: readable/writable by users of the owning station
CREATE POLICY "Users can view reports for their station"
  ON reports FOR SELECT
  USING (station_id IN (SELECT station_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can create reports for their station"
  ON reports FOR INSERT
  WITH CHECK (station_id IN (SELECT station_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can update reports for their station"
  ON reports FOR UPDATE
  USING (station_id IN (SELECT station_id FROM users WHERE id = auth.uid()));

-- report_versions: readable/writable by users of the owning station; delegates can insert
CREATE POLICY "Users can view report versions for their station"
  ON report_versions FOR SELECT
  USING (
    report_id IN (
      SELECT id FROM reports 
      WHERE station_id IN (SELECT station_id FROM users WHERE id = auth.uid())
    )
  );

CREATE POLICY "Users can create report versions for their station"
  ON report_versions FOR INSERT
  WITH CHECK (
    report_id IN (
      SELECT id FROM reports 
      WHERE station_id IN (SELECT station_id FROM users WHERE id = auth.uid())
    ) AND
    edited_by = auth.uid()
  );

-- No delete permission for report_versions (see specification §A.8)

-- bank_statements: readable/writable by users of the owning station
CREATE POLICY "Users can view bank statements for their station"
  ON bank_statements FOR SELECT
  USING (station_id IN (SELECT station_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can create bank statements for their station"
  ON bank_statements FOR INSERT
  WITH CHECK (station_id IN (SELECT station_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can update bank statements for their station"
  ON bank_statements FOR UPDATE
  USING (station_id IN (SELECT station_id FROM users WHERE id = auth.uid()));

-- discrepancy_flags: readable/writable by users of the owning station
CREATE POLICY "Users can view discrepancy flags for their station"
  ON discrepancy_flags FOR SELECT
  USING (
    report_version_id IN (
      SELECT id FROM report_versions
      WHERE report_id IN (
        SELECT id FROM reports 
        WHERE station_id IN (SELECT station_id FROM users WHERE id = auth.uid())
      )
    )
  );

CREATE POLICY "Users can create discrepancy flags for their station"
  ON discrepancy_flags FOR INSERT
  WITH CHECK (
    report_version_id IN (
      SELECT id FROM report_versions
      WHERE report_id IN (
        SELECT id FROM reports 
        WHERE station_id IN (SELECT station_id FROM users WHERE id = auth.uid())
      )
    )
  );

CREATE POLICY "Users can update discrepancy flags for their station"
  ON discrepancy_flags FOR UPDATE
  USING (
    report_version_id IN (
      SELECT id FROM report_versions
      WHERE report_id IN (
        SELECT id FROM reports 
        WHERE station_id IN (SELECT station_id FROM users WHERE id = auth.uid())
      )
    )
  );

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS update_stations_updated_at ON stations;
CREATE TRIGGER update_stations_updated_at BEFORE UPDATE ON stations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_templates_updated_at ON templates;
CREATE TRIGGER update_templates_updated_at BEFORE UPDATE ON templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_reports_updated_at ON reports;
CREATE TRIGGER update_reports_updated_at BEFORE UPDATE ON reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_bank_statements_updated_at ON bank_statements;
CREATE TRIGGER update_bank_statements_updated_at BEFORE UPDATE ON bank_statements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Monthly auto-compile function
CREATE OR REPLACE FUNCTION auto_compile_monthly_reports()
RETURNS void AS $$
DECLARE
  station_record RECORD;
  template_record RECORD;
  period_start DATE;
  period_end DATE;
  new_report_id UUID;
  new_report_version_id UUID;
  aggregated_data JSONB;
BEGIN
  -- Get first day of previous month
  period_start := DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month');
  -- Get last day of previous month
  period_end := DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 day';

  -- Iterate through all stations with active subscriptions or trials
  FOR station_record IN 
    SELECT id FROM stations 
    WHERE id IN (
      SELECT station_id FROM users 
      WHERE subscription_status IN ('active', 'trial')
    )
  LOOP
    -- Get the monthly template
    SELECT id INTO template_record.id
    FROM templates
    WHERE period_type = 'monthly'
    LIMIT 1;

    IF template_record.id IS NOT NULL THEN
      -- Aggregate data from all report versions in the period
      SELECT jsonb_object_agg(
        key, 
        CASE 
          WHEN data_type = 'currency' THEN SUM(COALESCE((data->>key)::numeric, 0))
          WHEN data_type = 'number' THEN SUM(COALESCE((data->>key)::numeric, 0))
          ELSE MAX(data->>key)
        END
      ) INTO aggregated_data
      FROM data_fields
      CROSS JOIN (
        SELECT data FROM report_versions
        WHERE report_id IN (
          SELECT id FROM reports
          WHERE station_id = station_record.id
          AND period_type = 'weekly'
          AND period_start >= period_start
          AND period_end <= period_end
        )
      ) AS weekly_data
      GROUP BY data_fields.key;

      -- Create the monthly report
      INSERT INTO reports (station_id, template_id, period_type, period_start, period_end)
      VALUES (station_record.id, template_record.id, 'monthly', period_start, period_end)
      RETURNING id INTO new_report_id;

      -- Create the report version
      INSERT INTO report_versions (report_id, template_version_id, data, edited_by, source)
      VALUES (
        new_report_id,
        (SELECT current_version_id FROM templates WHERE id = template_record.id),
        COALESCE(aggregated_data, '{}'::jsonb),
        (SELECT id FROM users WHERE station_id = station_record.id AND role = 'pastor' LIMIT 1),
        'auto_compile'
      )
      RETURNING id INTO new_report_version_id;

      -- Generate the Excel file (call the edge function)
      -- This would typically be done via a background job or notification
      -- For now, we'll just log it
      RAISE NOTICE 'Auto-compiled monthly report for station %: report_version_id = %', station_record.id, new_report_version_id;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Schedule the auto-compile to run on the 1st of every month at 2 AM
SELECT cron.schedule(
  'monthly-auto-compile',
  '0 2 1 * *', -- At 02:00 on day-of-month 1
  'SELECT auto_compile_monthly_reports();'
)
WHERE NOT EXISTS (
  SELECT 1 FROM cron.job WHERE jobid = 'monthly-auto-compile'
);
