export type UserRole = 'pastor' | 'delegate' | 'admin';
export type StationLevel = 'community' | 'area' | 'zonal' | 'district' | 'state' | 'headquarters';
export type PeriodType = 'weekly' | 'monthly' | 'quarterly' | 'half_year' | 'yearly';
export type SubscriptionStatus = 'trial' | 'active' | 'expired';
export type DataFieldCategory = 'attendance' | 'spiritual' | 'finance_income' | 'finance_expenditure' | 'bank';
export type DataType = 'number' | 'currency' | 'text';
export type ReportSource = 'manual' | 'whatsapp_text' | 'voice' | 'handwriting' | 'bank_reconciliation' | 'auto_compile';

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
  created_at: string;
  updated_at: string;
}

export interface Station {
  id: string;
  name: string;
  level: StationLevel;
  parent_station_id?: string;
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
