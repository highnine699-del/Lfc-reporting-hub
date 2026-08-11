export type UserRole = 'pastor' | 'delegate' | 'admin';
export type StationLevel = 'community' | 'area' | 'zonal' | 'district' | 'state' | 'headquarters';
export type StationCategory = 'mainline' | 'cotm' | 'cpm';
export type WofbiClass = 'bcc' | 'lcc' | 'ldc' | 'none';
export type PeriodType = 'weekly' | 'monthly' | 'quarterly' | 'half_year' | 'yearly';
export type SubscriptionStatus = 'trial' | 'active' | 'expired';
export type DataFieldCategory = 'attendance' | 'spiritual' | 'finance_income' | 'finance_expenditure' | 'bank';
export type DataType = 'number' | 'currency' | 'text';
export type ReportSource = 'manual' | 'whatsapp_text' | 'voice' | 'handwriting' | 'bank_reconciliation' | 'auto_compile' | 'excel_import';

/** How values from multiple service entries are combined when generating a report */
export type AggregationType = 'sum' | 'avg' | 'max' | 'latest' | 'fixed';

export interface FacilityDetails {
  main_hall_capacity: number | null;
  main_hall_chairs: number | null;
  overflow_capacity: number | null;
  overflow_chairs: number | null;
  youth_hall_capacity: number | null;
  youth_hall_chairs: number | null;
  children_hall_capacity: number | null;
  children_hall_chairs: number | null;
  facility_type: string | null; // e.g. "TEMPORARY", "PERMANENT"
}

export interface User {
  id: string;
  role: UserRole;
  full_name: string;
  staff_id?: string;
  phone_number?: string;
  station_id: string;
  linked_pastor_id?: string;
  subscription_status: SubscriptionStatus;
  trial_ends_at: string;
  /** Year of Entry into ministry */
  yoe?: string;
  /** Date of Resumption */
  dor?: string;
  created_at: string;
  updated_at: string;
}

export interface Station {
  id: string;
  name: string;
  level: StationLevel;
  category: StationCategory;
  state_name?: string;
  parent_station_id?: string;
  facility_details?: FacilityDetails;
  wofbi_class?: WofbiClass;
  created_at: string;
  updated_at: string;
}

export interface DelegatePairingCode {
  id: string;
  pastor_id: string;
  code: string;
  expires_at: string;
  used: boolean;
  created_at: string;
}

export interface Template {
  id: string;
  name: string;
  period_type: PeriodType;
  current_version_id?: string;
  created_at: string;
  updated_at: string;
}

export interface TemplateVersion {
  id: string;
  template_id: string;
  file_storage_path: string;
  version_number: number;
  created_at: string;
}

/**
 * A single column definition extracted from an uploaded template.
 * aggregation_type controls how service entry values are combined at report time.
 * row_index / col_index is the 0-based position in the template where data is written.
 */
export interface TemplateColumn {
  id: string;
  template_version_id: string;
  /** The raw header text from the Excel file */
  header_text: string;
  /** Normalised key used to match against service entry data (snake_case) */
  field_key: string;
  sheet_name: string;
  /** 1-based row in the template where data rows start */
  data_row_start: number;
  /** 0-based column index in the sheet */
  col_index: number;
  aggregation_type: AggregationType;
  /** Admin-provided friendly label (falls back to header_text) */
  display_label: string;
  /** Whether this column is a fixed station property (capacity, pastor name) vs service data */
  is_static: boolean;
  /** For static columns: which station/user field to pull from */
  static_source?: string;
  created_at: string;
}

export interface TemplateFieldMapping {
  id: string;
  template_version_id: string;
  sheet_name: string;
  cell_reference: string;
  data_field_key: string;
  label_text: string;
}

export interface DataField {
  key: string;
  category: DataFieldCategory;
  display_name: string;
  data_type: DataType;
}

export interface ExpenditureCategory {
  id: string;
  station_id: string;
  name: string;
  created_by: string;
  created_at: string;
}

/**
 * A single service entry — replaces the old "report" concept at the pastor level.
 * Pastors create one of these per service. data is a free-form JSON blob whose
 * keys match the field_key values of the active template's columns.
 */
export interface ServiceEntry {
  id: string;
  station_id: string;
  service_date: string; // ISO date string YYYY-MM-DD
  template_version_id: string | null;
  data: Record<string, any>;
  notes: string | null;
  entered_by: string;
  source: ReportSource;
  created_at: string;
  updated_at: string;
}

export interface Report {
  id: string;
  station_id: string;
  template_id: string;
  period_type: PeriodType;
  period_start: string;
  period_end: string;
  current_version_id?: string;
  created_at: string;
  updated_at: string;
}

export interface ReportVersion {
  id: string;
  report_id: string;
  template_version_id: string;
  data: Record<string, any>;
  edited_by: string;
  server_timestamp: string;
  source: ReportSource;
  generated_file_path?: string;
  created_at: string;
}

export interface BankStatement {
  id: string;
  station_id: string;
  file_storage_path: string;
  ocr_raw_text?: string;
  parsed_total?: number;
  linked_report_version_id?: string;
  confirmed_by?: string;
  created_at: string;
  updated_at: string;
}

export interface DiscrepancyFlag {
  id: string;
  report_version_id: string;
  bank_statement_id: string;
  reported_total: number;
  bank_total: number;
  difference: number;
  resolved: boolean;
  created_at: string;
}
