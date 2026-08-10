import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import type { AggregationType, FacilityDetails } from '../types';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
interface TemplateCol {
  id: string;
  field_key: string;
  display_label: string;
  header_text: string;
  aggregation_type: AggregationType;
  is_static: boolean;
  static_source: string | null;
  col_index: number;
  sheet_name: string;
  data_row_start: number;
}

interface StationRow {
  id: string;
  name: string;
  state_name: string | null;
  category: string;
  wofbi_class: string;
  facility_details: FacilityDetails | null;
}

interface UserRow {
  id: string;
  full_name: string;
  phone_number: string | null;
  yoe: string | null;
  dor: string | null;
  station_id: string;
}

// ─────────────────────────────────────────────────────────────
// Aggregation logic
// ─────────────────────────────────────────────────────────────
function aggregate(values: number[], type: AggregationType): number {
  if (values.length === 0) return 0;
  switch (type) {
    case 'sum': return values.reduce((a, b) => a + b, 0);
    case 'avg': return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
    case 'max': return Math.max(...values);
    case 'latest': return values[values.length - 1];
    case 'fixed': return values[0];
    default: return values.reduce((a, b) => a + b, 0);
  }
}

// ─────────────────────────────────────────────────────────────
// Resolve a static_source path against station + user objects
// e.g. "station.name" → station.name
//      "station.facility_details.main_hall_capacity" → fd.main_hall_capacity
// ─────────────────────────────────────────────────────────────
function resolveStatic(
  source: string | null,
  station: StationRow,
  pastor: UserRow | null,
): string | number {
  if (!source) return '';
  const parts = source.split('.');
  if (parts[0] === 'station') {
    if (parts[1] === 'facility_details' && parts[2]) {
      return (station.facility_details as any)?.[parts[2]] ?? '';
    }
    return (station as any)[parts[1]] ?? '';
  }
  if (parts[0] === 'user' && pastor) {
    return (pastor as any)[parts[1]] ?? '';
  }
  return '';
}

// ─────────────────────────────────────────────────────────────
// Compile service entries for ONE station into one data row
// ─────────────────────────────────────────────────────────────
function compileStation(
  entries: Array<{ data: Record<string, any>; service_date: string }>,
  columns: TemplateCol[],
  station: StationRow,
  pastor: UserRow | null,
): Record<string, string | number> {
  const result: Record<string, string | number> = {};

  for (const col of columns) {
    if (col.is_static) {
      result[col.field_key] = resolveStatic(col.static_source, station, pastor);
      continue;
    }

    // Collect numeric values from all entries, sorted by date ascending
    const sorted = [...entries].sort((a, b) =>
      a.service_date.localeCompare(b.service_date)
    );
    const values: number[] = sorted
      .map(e => {
        const v = e.data[col.field_key];
        return typeof v === 'number' ? v : parseFloat(v);
      })
      .filter(v => !isNaN(v));

    result[col.field_key] = aggregate(values, col.aggregation_type);
  }

  return result;
}

// ─────────────────────────────────────────────────────────────
// Collect all descendants of a station (for supervisor view)
// ─────────────────────────────────────────────────────────────
function collectDescendants(
  rootId: string,
  allStations: Array<{ id: string; parent_station_id: string | null }>,
  depth = 0,
): string[] {
  if (depth > 6) return [];
  const children = allStations.filter(s => s.parent_station_id === rootId);
  return children.flatMap(c => [c.id, ...collectDescendants(c.id, allStations, depth + 1)]);
}

// ─────────────────────────────────────────────────────────────
// Period helpers
// ─────────────────────────────────────────────────────────────
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => currentYear - i);

type PeriodMode = 'monthly' | 'quarterly' | 'half_year' | 'yearly';

interface PeriodRange { start: string; end: string; label: string; }

function getPeriodRange(mode: PeriodMode, month: number, year: number): PeriodRange {
  const pad = (n: number) => String(n).padStart(2, '0');
  if (mode === 'monthly') {
    const last = new Date(year, month + 1, 0).getDate();
    return {
      start: `${year}-${pad(month + 1)}-01`,
      end: `${year}-${pad(month + 1)}-${pad(last)}`,
      label: `${MONTHS[month]} ${year}`,
    };
  }
  if (mode === 'quarterly') {
    const q = Math.floor(month / 3); // 0-3
    const startMonth = q * 3;
    const endMonth = startMonth + 2;
    const last = new Date(year, endMonth + 1, 0).getDate();
    return {
      start: `${year}-${pad(startMonth + 1)}-01`,
      end: `${year}-${pad(endMonth + 1)}-${pad(last)}`,
      label: `Q${q + 1} ${year}`,
    };
  }
  if (mode === 'half_year') {
    const isH2 = month >= 6;
    const startMonth = isH2 ? 6 : 0;
    const endMonth = isH2 ? 11 : 5;
    const last = new Date(year, endMonth + 1, 0).getDate();
    return {
      start: `${year}-${pad(startMonth + 1)}-01`,
      end: `${year}-${pad(endMonth + 1)}-${pad(last)}`,
      label: `${isH2 ? 'H2' : 'H1'} ${year}`,
    };
  }
  // yearly
  return {
    start: `${year}-01-01`,
    end: `${year}-12-31`,
    label: `${year}`,
  };
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────
export default function GenerateReport() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const now = new Date();
  const [periodMode, setPeriodMode] = useState<PeriodMode>('monthly');
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth()); // 0-based
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [generating, setGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<
    Array<{ station: StationRow; pastor: UserRow | null; compiled: Record<string, string | number> }> | null
  >(null);

  // Derived period range
  const period = useMemo(
    () => getPeriodRange(periodMode, selectedMonth, selectedYear),
    [periodMode, selectedMonth, selectedYear]
  );
  const periodStart = period.start;
  const periodEnd = period.end;

  // ── fetch templates ──────────────────────────────────────
  const { data: templates } = useQuery({
    queryKey: ['templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('templates')
        .select('id, name, period_type, current_version_id')
        .order('name');
      if (error) throw error;
      return data ?? [];
    },
  });

  // ── fetch template columns for selected template ─────────
  const { data: templateVersion } = useQuery({
    queryKey: ['template-version', selectedTemplateId],
    queryFn: async () => {
      const tmpl = templates?.find((t: any) => t.id === selectedTemplateId);
      if (!tmpl?.current_version_id) return null;

      const { data: cols, error } = await supabase
        .from('template_columns')
        .select('*')
        .eq('template_version_id', tmpl.current_version_id)
        .order('col_index');
      if (error) throw error;

      // Fetch the actual Excel file path
      const { data: ver } = await supabase
        .from('template_versions')
        .select('file_storage_path')
        .eq('id', tmpl.current_version_id)
        .single();

      return { cols: (cols ?? []) as TemplateCol[], filePath: ver?.file_storage_path ?? null, versionId: tmpl.current_version_id };
    },
    enabled: !!selectedTemplateId && !!templates,
  });

  // ── fetch all stations for hierarchy ─────────────────────
  const { data: allStations } = useQuery({
    queryKey: ['all-stations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stations')
        .select('id, name, state_name, category, wofbi_class, facility_details, parent_station_id, level');
      if (error) throw error;
      return data ?? [];
    },
  });

  // Which stations to compile: always own station + ALL descendants
  const targetStationIds = useMemo(() => {
    if (!user?.station_id || !allStations) return [];
    const descendants = collectDescendants(user.station_id, allStations);
    // Always include own station; add descendants if this is a supervisor
    return [user.station_id, ...descendants];
  }, [user?.station_id, allStations]);

  const isSupervisor = useMemo(() => {
    if (!user?.station_id || !allStations) return false;
    return allStations.some((s: any) => s.parent_station_id === user.station_id);
  }, [user?.station_id, allStations]);

  // ── fetch service entries for the period ─────────────────
  const { data: entriesData, isLoading: loadingEntries } = useQuery({
    queryKey: ['service-entries-period', targetStationIds, periodStart, periodEnd],
    queryFn: async () => {
      if (!targetStationIds.length) return [];
      const { data, error } = await supabase
        .from('service_entries')
        .select('id, station_id, service_date, data')
        .in('station_id', targetStationIds)
        .gte('service_date', periodStart)
        .lte('service_date', periodEnd)
        .is('deleted_at', null)
        .order('service_date');
      if (error) throw error;
      return data ?? [];
    },
    enabled: targetStationIds.length > 0,
  });

  // ── fetch pastors for each station ───────────────────────
  const { data: pastors } = useQuery({
    queryKey: ['station-pastors', targetStationIds],
    queryFn: async () => {
      if (!targetStationIds.length) return [];
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, phone_number, yoe, dor, station_id')
        .in('station_id', targetStationIds)
        .eq('role', 'pastor');
      if (error) throw error;
      return data ?? [];
    },
    enabled: targetStationIds.length > 0,
  });

  // ── build preview data ───────────────────────────────────
  const buildPreview = () => {
    if (!templateVersion?.cols || !allStations || !entriesData) return;

    const stationMap = new Map<string, StationRow>(
      allStations.map((s: any) => [s.id, s])
    );
    const pastorMap = new Map<string, UserRow>();
    (pastors ?? []).forEach((p: any) => pastorMap.set(p.station_id, p));

    const entriesByStation = new Map<string, typeof entriesData>();
    (entriesData ?? []).forEach((e: any) => {
      if (!entriesByStation.has(e.station_id)) entriesByStation.set(e.station_id, []);
      entriesByStation.get(e.station_id)!.push(e);
    });

    const rows = targetStationIds
      .map(sid => {
        const station = stationMap.get(sid);
        if (!station) return null;
        const entries = entriesByStation.get(sid) ?? [];
        const pastor = pastorMap.get(sid) ?? null;
        const compiled = compileStation(entries, templateVersion.cols, station, pastor);
        return { station, pastor, compiled };
      })
      .filter(Boolean) as Array<{ station: StationRow; pastor: UserRow | null; compiled: Record<string, string | number> }>;

    setPreviewData(rows);
  };

  // ── auto-build preview whenever inputs are ready ────────
  // Replaces the manual "Build Preview" button — runs automatically
  // when both template and entries are loaded.
  useEffect(() => {
    if (templateVersion?.cols && allStations && entriesData && selectedTemplateId) {
      buildPreview();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateVersion, entriesData, pastors, allStations, selectedTemplateId]);

  // ── generate Excel ───────────────────────────────────────
  const handleGenerate = async () => {
    if (!selectedTemplateId) { setErrorMsg('Please select a template.'); return; }
    if (!templateVersion?.filePath) { setErrorMsg('No Excel file found for this template. Please ask an admin to upload one.'); return; }
    if (!previewData || previewData.length === 0) { setErrorMsg('No data to generate. Check that service entries exist for this period.'); return; }

    setGenerating(true);
    setErrorMsg(null);

    try {
      // 1. Download template file from storage
      const { data: fileData, error: dlErr } = await supabase.storage
        .from('templates')
        .download(templateVersion.filePath);
      if (dlErr) throw dlErr;

      // 2. Load workbook
      const ExcelJS = await import('exceljs');
      const WorkbookClass = (ExcelJS as any).default?.Workbook ?? (ExcelJS as any).Workbook;
      const wb = new WorkbookClass();
      await wb.xlsx.load(await fileData.arrayBuffer());

      // 3. Group columns by sheet
      const colsBySheet = new Map<string, TemplateCol[]>();
      for (const col of templateVersion.cols) {
        if (!colsBySheet.has(col.sheet_name)) colsBySheet.set(col.sheet_name, []);
        colsBySheet.get(col.sheet_name)!.push(col);
      }

      // 4. For each sheet, write rows
      for (const [sheetName, sheetCols] of colsBySheet.entries()) {
        const ws = wb.getWorksheet(sheetName);
        if (!ws) continue;

        const dataRowStart = sheetCols[0].data_row_start;

        // Filter stations that belong on this sheet (by category matching sheet name)
        const sheetNameLower = sheetName.toLowerCase();
        const sheetStations = previewData.filter(({ station }) => {
          const cat = station.category?.toLowerCase() ?? '';
          if (sheetNameLower.includes('mainline') && cat === 'mainline') return true;
          if ((sheetNameLower.includes('cotm') || sheetNameLower.includes('5,000')) && cat === 'cotm') return true;
          if ((sheetNameLower.includes('cpm') || sheetNameLower.includes('10,000')) && cat === 'cpm') return true;
          // If sheet name doesn't match a category keyword, include all stations
          if (!sheetNameLower.includes('mainline') && !sheetNameLower.includes('cotm') &&
            !sheetNameLower.includes('cpm') && !sheetNameLower.includes('5,000') &&
            !sheetNameLower.includes('10,000')) return true;
          return false;
        });

        sheetStations.forEach(({ compiled }, rowIdx) => {
          const rowNum = dataRowStart + rowIdx;
          for (const col of sheetCols) {
            const cell = ws.getCell(rowNum, col.col_index + 1); // ExcelJS is 1-based
            const val = compiled[col.field_key];
            if (val !== undefined && val !== '') cell.value = val;
          }

          // Write SN (serial number) in column 1 if it looks empty
          const snCell = ws.getCell(rowNum, 1);
          if (!snCell.value) snCell.value = rowIdx + 1;
        });

        // Write month name into cells that look like month/period headers
        // (cells in the header area containing "month:" or similar)
        const monthLabel = period.label;
        ws.eachRow((row: any, rn: number) => {
          if (rn >= dataRowStart) return;
          row.eachCell((cell: any) => {
            const v = cell.value?.toString() ?? '';
            if (/month\s*:/i.test(v)) {
              cell.value = v.replace(/month\s*:.*$/i, `MONTH: ${monthLabel.toUpperCase()}`);
            }
          });
        });
      }

      // 5. Write to buffer and trigger download
      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `LFC_Report_${period.label.replace(/\s/g, '_')}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

    } catch (err: any) {
      console.error('Generate error:', err);
      setErrorMsg('Failed to generate report: ' + (err.message ?? 'unknown error'));
    } finally {
      setGenerating(false);
    }
  };

  // ── entry count summary ──────────────────────────────────
  const entryCount = entriesData?.length ?? 0;
  const stationCount = new Set(entriesData?.map((e: any) => e.station_id)).size;

  // ─────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <button onClick={() => navigate('/dashboard')} className="btn btn-ghost text-sm">← Back to Dashboard</button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Generate Report</h1>
          <p className="text-sm text-gray-500 mt-1">
            {isSupervisor
              ? 'Compiles service entries from all stations under you into one Excel file.'
              : 'Compiles your service entries for the selected period into the Excel template.'}
          </p>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 flex justify-between">
            <span>{errorMsg}</span>
            <button onClick={() => setErrorMsg(null)} className="ml-2 text-red-400">✕</button>
          </div>
        )}

        {/* ── Step 1: Pick period ──────────────────────── */}
        <div className="card p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">1. Select Period</h2>

          {/* Period type */}
          <div className="flex flex-wrap gap-2 mb-4">
            {([
              { val: 'monthly', label: 'Monthly' },
              { val: 'quarterly', label: 'Quarterly' },
              { val: 'half_year', label: 'Half-Yearly' },
              { val: 'yearly', label: 'Yearly' },
            ] as const).map(({ val, label }) => (
              <button
                key={val}
                onClick={() => { setPeriodMode(val); setPreviewData(null); }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${periodMode === val
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-4">
            {periodMode !== 'yearly' && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  {periodMode === 'monthly' ? 'Month' : periodMode === 'quarterly' ? 'Quarter starts in' : 'Half starts in'}
                </label>
                <select
                  value={selectedMonth}
                  onChange={e => { setSelectedMonth(Number(e.target.value)); setPreviewData(null); }}
                  className="input"
                >
                  {periodMode === 'monthly' && MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
                  {periodMode === 'quarterly' && [0, 3, 6, 9].map(i => <option key={i} value={i}>Q{Math.floor(i / 3) + 1} — {MONTHS[i]}</option>)}
                  {periodMode === 'half_year' && [0, 6].map(i => <option key={i} value={i}>{i === 0 ? 'H1 (Jan–Jun)' : 'H2 (Jul–Dec)'}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Year</label>
              <select
                value={selectedYear}
                onChange={e => { setSelectedYear(Number(e.target.value)); setPreviewData(null); }}
                className="input"
              >
                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>

          {/* Period label + entry count */}
          <div className={`mt-4 p-3 rounded-lg text-sm ${entryCount > 0 ? 'bg-green-50 text-green-800' : 'bg-yellow-50 text-yellow-800'}`}>
            {loadingEntries
              ? 'Loading entries…'
              : entryCount > 0
                ? `✓ ${entryCount} service entr${entryCount !== 1 ? 'ies' : 'y'} across ${stationCount} station${stationCount !== 1 ? 's' : ''} — ${period.label}`
                : `No entries for ${period.label}. Make sure entries have been added before generating.`}
          </div>
        </div>

        {/* ── Step 2: Pick template ────────────────────── */}
        <div className="card p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">2. Select Template</h2>
          {!templates?.length ? (
            <p className="text-sm text-gray-400">No templates available. Ask an admin to upload one.</p>
          ) : (
            <div className="space-y-3">
              <select
                value={selectedTemplateId}
                onChange={e => { setSelectedTemplateId(e.target.value); setPreviewData(null); }}
                className="input max-w-sm"
              >
                <option value="">— choose template —</option>
                {templates.map((t: any) => (
                  <option key={t.id} value={t.id}>{t.name} ({t.period_type})</option>
                ))}
              </select>

              {selectedTemplateId && !templateVersion && (
                <p className="text-xs text-yellow-600">Loading template columns…</p>
              )}
              {templateVersion && (
                <p className="text-xs text-green-600">
                  ✓ {templateVersion.cols.length} columns loaded
                  {templateVersion.filePath ? ' — Excel template file found' : ' — ⚠ No Excel file attached to this template'}
                </p>
              )}
            </div>
          )}
        </div>

        {/* ── Step 3: Preview (auto-built) ─────────────── */}
        <div className="card p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">3. Preview Data</h2>

          {!selectedTemplateId && (
            <p className="text-sm text-gray-400">Select a template above to see a preview.</p>
          )}

          {selectedTemplateId && !templateVersion && (
            <p className="text-xs text-yellow-600">Loading template columns…</p>
          )}

          {selectedTemplateId && templateVersion && !previewData && (
            <p className="text-sm text-gray-400">
              {loadingEntries ? 'Loading entries…' : 'Building preview…'}
            </p>
          )}

          {previewData && previewData.length === 0 && (
            <p className="text-sm text-yellow-600">No stations with data found for {period.label}.</p>
          )}

          {previewData && previewData.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs text-gray-500">
                {previewData.length} station{previewData.length !== 1 ? 's' : ''} · {period.label} · updates automatically when you change period or template
              </p>
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap">Station</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap">Cat.</th>
                      {templateVersion?.cols.slice(0, 8).map(c => (
                        <th key={c.field_key} className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap truncate max-w-24" title={c.display_label}>
                          {c.display_label.length > 12 ? c.display_label.slice(0, 12) + '…' : c.display_label}
                        </th>
                      ))}
                      {(templateVersion?.cols.length ?? 0) > 8 && (
                        <th className="px-3 py-2 text-gray-400">+{(templateVersion?.cols.length ?? 0) - 8}</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {previewData.map(({ station, compiled }, i) => (
                      <tr key={station.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-3 py-2 font-medium text-gray-900 whitespace-nowrap">{station.name}</td>
                        <td className="px-3 py-2 text-gray-500 uppercase text-xs">{station.category}</td>
                        {templateVersion?.cols.slice(0, 8).map(c => (
                          <td key={c.field_key} className="px-3 py-2 text-gray-700">
                            {compiled[c.field_key] !== undefined && compiled[c.field_key] !== ''
                              ? typeof compiled[c.field_key] === 'number'
                                ? (compiled[c.field_key] as number).toLocaleString()
                                : compiled[c.field_key]
                              : <span className="text-gray-300">—</span>}
                          </td>
                        ))}
                        {(templateVersion?.cols.length ?? 0) > 8 && <td className="px-3 py-2 text-gray-300">…</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* ── Step 4: Generate ─────────────────────────── */}
        <div className="card p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-2">4. Generate & Download</h2>
          <p className="text-sm text-gray-500 mb-4">
            The app will fill the Excel template with the compiled data and download it to your device.
            You can then send it to your supervisor.
          </p>
          <button
            onClick={handleGenerate}
            disabled={
              generating ||
              !selectedTemplateId ||
              !templateVersion?.filePath ||
              !previewData ||
              previewData.length === 0
            }
            className="btn btn-primary text-base w-full sm:w-auto"
          >
            {generating
              ? 'Generating…'
              : `Download ${period.label} Report`}
          </button>

          {!templateVersion?.filePath && selectedTemplateId && (
            <p className="mt-2 text-xs text-red-500">
              ⚠ No Excel file attached to this template. An admin needs to upload the template file
              under Admin → Template Mapping.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
