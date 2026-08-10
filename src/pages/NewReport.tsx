import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import type { AggregationType } from '../types';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
interface TemplateCol {
  id: string;
  field_key: string;
  display_label: string;
  aggregation_type: AggregationType;
  is_static: boolean;
  col_index: number;
}

type InputMethod = 'manual' | 'whatsapp' | 'voice' | 'excel';

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/** Detect if a field is a currency field by its key/label */
function isCurrency(col: TemplateCol): boolean {
  return /income|tithe|offer|thank|kcc|shiloh|project|rof|exp|wsf|amount|fund/.test(
    col.field_key.toLowerCase()
  );
}

/** Parse a raw cell value from ExcelJS into a JS primitive */
function parseCellValue(val: any): string | number {
  if (val == null) return '';
  if (typeof val === 'object' && 'result' in val) return parseCellValue(val.result);
  if (typeof val === 'object' && 'text' in val) return val.text;
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  return val;
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────
export default function NewReport() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // ── core state ──────────────────────────────────────────
  const [serviceDate, setServiceDate] = useState('');
  const [inputMethod, setInputMethod] = useState<InputMethod>('manual');
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState(false);

  // ── whatsapp / voice ────────────────────────────────────
  const [rawText, setRawText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [parsedData, setParsedData] = useState<Record<string, any> | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [recognition, setRecognition] = useState<any>(null);

  // ── excel import ────────────────────────────────────────
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [excelRows, setExcelRows] = useState<Array<{ date: string; data: Record<string, any> }>>([]);
  const [excelScanning, setExcelScanning] = useState(false);
  const [excelImporting, setExcelImporting] = useState(false);
  const [importDone, setImportDone] = useState(false);

  // ── fetch active template columns (non-static only) ─────
  const { data: templateInfo } = useQuery({
    queryKey: ['active-template-columns', user?.station_id],
    queryFn: async () => {
      // Get the most recently published template_version
      const { data: version, error: vErr } = await supabase
        .from('template_versions')
        .select('id, template_id, templates(name, period_type)')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (vErr) throw vErr;
      if (!version) return null;

      const { data: cols, error: cErr } = await supabase
        .from('template_columns')
        .select('id, field_key, display_label, aggregation_type, is_static, col_index')
        .eq('template_version_id', version.id)
        .eq('is_static', false)  // static cols come from station profile, not service entry
        .order('col_index');
      if (cErr) throw cErr;

      return { version, cols: (cols ?? []) as TemplateCol[] };
    },
    enabled: !!user,
  });

  const columns: TemplateCol[] = templateInfo?.cols ?? [];
  const hasTemplate = columns.length > 0;

  // ── field change ─────────────────────────────────────────
  const setField = (key: string, raw: string) => {
    const num = Number(raw);
    setFormData(prev => ({ ...prev, [key]: raw === '' ? '' : isNaN(num) ? raw : num }));
  };

  // ── duplicate date check ──────────────────────────────────
  const checkDuplicate = async (date: string) => {
    if (!user?.station_id || !date) { setDuplicateWarning(false); return; }
    const { count } = await supabase
      .from('service_entries')
      .select('id', { count: 'exact', head: true })
      .eq('station_id', user.station_id)
      .eq('service_date', date)
      .is('deleted_at', null);
    setDuplicateWarning((count ?? 0) > 0);
  };

  const handleDateChange = (date: string) => {
    setServiceDate(date);
    checkDuplicate(date);
  };

  // ── parse whatsapp / voice ───────────────────────────────
  const handleParse = async (text: string) => {
    setParsing(true);
    setErrorMsg(null);
    try {
      const { data, error } = await supabase.functions.invoke('parse-whatsapp-text', {
        body: { text },
      });
      if (error) throw error;
      setParsedData(data.data ?? {});
      // Pre-fill formData from parsed values
      setFormData(data.data ?? {});
    } catch (err: any) {
      setErrorMsg('Could not parse text: ' + (err.message ?? 'unknown error'));
    } finally {
      setParsing(false);
    }
  };

  // ── voice recording ──────────────────────────────────────
  const startRecording = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      setErrorMsg('Voice input is not supported in this browser or when the app is installed as a PWA. Open the app in Chrome browser (not the installed app) to use voice input.');
      return;
    }
    if (recognition) { try { recognition.stop(); } catch (_) { } }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const r = new SR();
    r.continuous = true;
    r.interimResults = true;
    r.lang = 'en-US';
    r.onstart = () => setIsRecording(true);
    r.onresult = (e: any) => {
      let final = '', interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t + ' '; else interim += t;
      }
      setTranscript(final + interim);
    };
    r.onerror = (e: any) => { if (e.error !== 'aborted') { setIsRecording(false); setErrorMsg('Speech error: ' + e.error); } };
    r.onend = () => setIsRecording(false);
    setRecognition(r);
    setTimeout(() => { try { r.start(); } catch (_) { setIsRecording(false); } }, 100);
  };

  const stopRecording = () => {
    recognition?.stop();
    setIsRecording(false);
  };

  // ── Excel import: scan file ──────────────────────────────
  const handleExcelFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setExcelFile(file);
    setExcelRows([]);
    setImportDone(false);
    setExcelScanning(true);
    setErrorMsg(null);

    try {
      const ExcelJS = await import('exceljs');
      const WorkbookClass = (ExcelJS as any).default?.Workbook ?? (ExcelJS as any).Workbook;
      const wb = new WorkbookClass();
      await wb.xlsx.load(await file.arrayBuffer());

      const ws = wb.worksheets[0];
      if (!ws) throw new Error('No worksheet found in this file.');

      // Find header row (first row with 3+ non-empty cells)
      let headerRowNum = 1;
      ws.eachRow((row: any, rn: number) => {
        if (row.values.filter((v: any) => v != null && v !== '').length >= 3 && headerRowNum === 1) {
          headerRowNum = rn;
        }
      });

      // Build header → col_index map
      const headerRow = ws.getRow(headerRowNum);
      const headerMap: Record<string, number> = {};
      headerRow.eachCell((cell: any, cn: number) => {
        const raw = cell.value?.toString().trim() ?? '';
        if (raw) headerMap[raw.toLowerCase()] = cn;
      });

      // Match headers to template columns by field_key / display_label / substring
      const colMatches: Record<string, number> = {}; // field_key → excel col number
      for (const col of columns) {
        const fk = col.field_key.toLowerCase().replace(/_/g, ' ');
        const dl = col.display_label.toLowerCase();
        for (const [h, cn] of Object.entries(headerMap)) {
          if (h === fk || h === dl || h.includes(fk) || fk.includes(h) || h.includes(dl) || dl.includes(h)) {
            colMatches[col.field_key] = cn;
            break;
          }
        }
      }

      // Find a "date" column
      const dateColNum = headerMap['date'] ?? headerMap['service date'] ?? headerMap['week'] ?? headerMap['day'] ?? null;

      // Extract data rows
      const rows: Array<{ date: string; data: Record<string, any> }> = [];
      ws.eachRow((row: any, rn: number) => {
        if (rn <= headerRowNum) return;
        const rowData: Record<string, any> = {};
        let hasData = false;
        for (const [fk, cn] of Object.entries(colMatches)) {
          const raw = parseCellValue(row.getCell(cn).value);
          if (raw !== '' && raw !== 0) hasData = true;
          rowData[fk] = raw;
        }
        if (!hasData) return; // skip empty rows

        let date = '';
        if (dateColNum) {
          const dv = row.getCell(dateColNum).value;
          if (dv instanceof Date) date = dv.toISOString().slice(0, 10);
          else if (dv) date = String(dv);
        }
        rows.push({ date, data: rowData });
      });

      setExcelRows(rows);
    } catch (err: any) {
      setErrorMsg('Could not read Excel file: ' + (err.message ?? 'unknown error'));
    } finally {
      setExcelScanning(false);
    }
  };

  const handleExcelImport = async () => {
    if (!user?.station_id || excelRows.length === 0) return;
    setExcelImporting(true);
    setErrorMsg(null);

    try {
      const inserts = excelRows.map(row => ({
        station_id: user.station_id,
        service_date: row.date || new Date().toISOString().slice(0, 10),
        template_version_id: templateInfo?.version?.id ?? null,
        data: row.data,
        entered_by: user.id,
        source: 'excel_import',
      }));

      const { error } = await supabase.from('service_entries').insert(inserts);
      if (error) throw error;
      setImportDone(true);
    } catch (err: any) {
      setErrorMsg('Import failed: ' + (err.message ?? 'unknown error'));
    } finally {
      setExcelImporting(false);
    }
  };

  // ── save service entry ───────────────────────────────────
  const handleSave = async () => {
    if (!user?.station_id) return;
    if (!serviceDate) { setErrorMsg('Please select a service date.'); return; }
    setSaving(true);
    setErrorMsg(null);

    try {
      const { error } = await supabase.from('service_entries').insert({
        station_id: user.station_id,
        service_date: serviceDate,
        template_version_id: templateInfo?.version?.id ?? null,
        data: formData,
        entered_by: user.id,
        source: inputMethod === 'whatsapp' ? 'whatsapp_text'
          : inputMethod === 'voice' ? 'voice'
            : 'manual',
      });
      if (error) throw error;
      navigate('/dashboard');
    } catch (err: any) {
      setErrorMsg('Failed to save: ' + (err.message ?? 'unknown error'));
    } finally {
      setSaving(false);
    }
  };

  // ── subscription guard ───────────────────────────────────
  if (user?.subscription_status === 'expired') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="card p-8 max-w-md w-full text-center">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Subscription Expired</h2>
          <p className="text-sm text-gray-500 mb-6">Please renew to enter service data.</p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => navigate('/settings')} className="btn btn-primary">Renew</button>
            <button onClick={() => navigate('/dashboard')} className="btn btn-secondary">Dashboard</button>
          </div>
        </div>
      </div>
    );
  }

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

      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Record Service Entry</h1>
          <p className="text-sm text-gray-500 mt-1">Enter data for a single service. One entry per service day.</p>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 flex justify-between">
            <span>{errorMsg}</span>
            <button onClick={() => setErrorMsg(null)} className="ml-2 text-red-400">✕</button>
          </div>
        )}

        {/* ── Input method tabs — scrollable on small screens ── */}
        <div className="card p-1" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <div style={{ display: 'flex', gap: 4, minWidth: 'max-content' }}>
            {([
              { key: 'manual', label: 'Manual' },
              { key: 'whatsapp', label: 'WhatsApp' },
              { key: 'voice', label: 'Voice' },
              { key: 'excel', label: 'Excel Import' },
            ] as const).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => { setInputMethod(key); setErrorMsg(null); }}
                style={{
                  padding: '10px 16px',
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  background: inputMethod === key ? 'var(--accent)' : 'transparent',
                  color: inputMethod === key ? '#fff' : 'var(--text-muted)',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ══════════════════════════════════════════════
            EXCEL IMPORT TAB — separate flow, no date needed
            ══════════════════════════════════════════════ */}
        {inputMethod === 'excel' && (
          <div className="card p-6 space-y-5">
            <div>
              <h2 className="text-base font-semibold text-gray-900 mb-1">Import from Excel</h2>
              <p className="text-sm text-gray-500">
                Upload your existing Excel data file. The app will match its columns to the current
                template fields and create a service entry for each row.
              </p>
            </div>

            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleExcelFileChange}
              className="block w-full text-sm text-gray-500
                file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0
                file:text-sm file:font-medium file:bg-indigo-50 file:text-indigo-700
                hover:file:bg-indigo-100"
            />

            {excelScanning && <p className="text-sm text-indigo-500">Scanning file…</p>}

            {excelRows.length > 0 && !importDone && (
              <div className="space-y-4">
                <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3">
                  <p className="text-sm font-medium text-indigo-800">
                    {excelRows.length} row{excelRows.length !== 1 ? 's' : ''} detected
                  </p>
                  <p className="text-xs text-indigo-600 mt-0.5">
                    Each row will become one service entry. Rows without a date will use today's date.
                  </p>
                </div>

                {/* Preview first 5 rows */}
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-gray-600">Date</th>
                        {columns.slice(0, 5).map(c => (
                          <th key={c.field_key} className="px-3 py-2 text-left font-medium text-gray-600 truncate max-w-24">
                            {c.display_label}
                          </th>
                        ))}
                        {columns.length > 5 && <th className="px-3 py-2 text-gray-400">+{columns.length - 5} more</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {excelRows.slice(0, 5).map((row, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-gray-700">{row.date || '—'}</td>
                          {columns.slice(0, 5).map(c => (
                            <td key={c.field_key} className="px-3 py-2 text-gray-600">
                              {row.data[c.field_key] ?? '—'}
                            </td>
                          ))}
                          {columns.length > 5 && <td className="px-3 py-2 text-gray-400">…</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {excelRows.length > 5 && (
                    <p className="px-3 py-2 text-xs text-gray-400 border-t border-gray-100">
                      …and {excelRows.length - 5} more rows
                    </p>
                  )}
                </div>

                <button
                  onClick={handleExcelImport}
                  disabled={excelImporting}
                  className="btn btn-primary w-full"
                >
                  {excelImporting ? 'Importing…' : `Import ${excelRows.length} entries`}
                </button>
              </div>
            )}

            {importDone && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                <p className="text-sm font-medium text-green-800">
                  ✓ {excelRows.length} service entries imported successfully
                </p>
                <div className="flex gap-3 justify-center mt-4">
                  <button onClick={() => navigate('/reports')} className="btn btn-primary text-sm">View Entries</button>
                  <button onClick={() => navigate('/dashboard')} className="btn btn-secondary text-sm">Dashboard</button>
                </div>
              </div>
            )}

            {excelFile && excelRows.length === 0 && !excelScanning && (
              <p className="text-sm text-gray-400">No matching data rows found. Make sure the file has column headers that match the current template.</p>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════
            MANUAL / WHATSAPP / VOICE TABS
            ══════════════════════════════════════════════ */}
        {inputMethod !== 'excel' && (
          <>
            {/* Service date */}
            <div className="card p-5">
              <label className="block text-sm font-semibold text-gray-900 mb-2">Service Date *</label>
              <input
                type="date"
                value={serviceDate}
                onChange={e => handleDateChange(e.target.value)}
                max={new Date().toISOString().slice(0, 10)}
                className="input max-w-xs"
              />
              {duplicateWarning && (
                <div className="mt-2 p-2.5 rounded-lg bg-yellow-50 border border-yellow-200 text-xs text-yellow-800">
                  ⚠ An entry already exists for this date. You can still save — this will create a second entry for the same day.
                  <button
                    onClick={() => navigate('/reports')}
                    className="ml-2 underline font-medium"
                  >
                    View existing entries
                  </button>
                </div>
              )}
            </div>

            {/* WhatsApp text input */}
            {inputMethod === 'whatsapp' && (
              <div className="card p-5 space-y-3">
                <label className="block text-sm font-semibold text-gray-900">Paste WhatsApp Report Message</label>
                <textarea
                  value={rawText}
                  onChange={e => setRawText(e.target.value)}
                  rows={7}
                  className="input"
                  placeholder="Paste the WhatsApp message containing your service report here…"
                />
                <button
                  onClick={() => handleParse(rawText)}
                  disabled={!rawText.trim() || parsing}
                  className="btn btn-secondary text-sm"
                >
                  {parsing ? 'Reading…' : 'Extract Data'}
                </button>
                {parsedData && (
                  <p className="text-xs text-green-600">
                    ✓ Data extracted — review and edit the fields below before saving.
                  </p>
                )}
              </div>
            )}

            {/* Voice input */}
            {inputMethod === 'voice' && (
              <div className="card p-5 space-y-3">
                <label className="block text-sm font-semibold text-gray-900">Voice Input</label>
                <div className="flex gap-3 items-center">
                  {!isRecording ? (
                    <button onClick={startRecording} className="btn btn-danger text-sm">● Start Recording</button>
                  ) : (
                    <button onClick={stopRecording} className="btn btn-secondary text-sm">■ Stop</button>
                  )}
                  {isRecording && (
                    <span className="flex items-center gap-1.5 text-sm text-red-600">
                      <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" /> Recording…
                    </span>
                  )}
                </div>
                <textarea
                  value={transcript}
                  onChange={e => setTranscript(e.target.value)}
                  rows={5}
                  className="input"
                  placeholder="Your spoken transcript will appear here…"
                />
                <button
                  onClick={() => handleParse(transcript)}
                  disabled={!transcript.trim() || parsing}
                  className="btn btn-secondary text-sm"
                >
                  {parsing ? 'Reading…' : 'Extract Data'}
                </button>
              </div>
            )}

            {/* Dynamic form fields from template */}
            {!hasTemplate && (
              <div className="card p-5 bg-yellow-50 border-yellow-200">
                <p className="text-sm font-medium text-yellow-800">No template configured yet</p>
                <p className="text-xs text-yellow-700 mt-1">
                  An admin needs to upload and publish a reporting template before service data can be
                  entered. You can still save a basic entry now.
                </p>
              </div>
            )}

            {/* Fields — grouped by implicit category from field_key */}
            {columns.length > 0 && (
              <DynamicFieldGroups columns={columns} formData={formData} setField={setField} />
            )}

            {/* Fallback: if no template, show a freeform notes field */}
            {!hasTemplate && (
              <div className="card p-5">
                <label className="block text-sm font-medium text-gray-700 mb-2">Notes / Data</label>
                <textarea
                  value={formData['notes'] ?? ''}
                  onChange={e => setField('notes', e.target.value)}
                  rows={4}
                  className="input"
                  placeholder="Enter any service data here as free text…"
                />
              </div>
            )}

            {/* Save */}
            <div className="flex gap-3">
              <button
                onClick={handleSave}
                disabled={saving || !serviceDate}
                className="btn btn-primary flex-1 text-base"
              >
                {saving ? 'Saving…' : 'Save Entry'}
              </button>
              <button onClick={() => navigate('/dashboard')} className="btn btn-secondary">
                Cancel
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// DynamicFieldGroups
// Groups columns by rough category (attendance / spiritual /
// finance_income / expenditure / other) and renders them.
// ─────────────────────────────────────────────────────────────
function DynamicFieldGroups({
  columns, formData, setField,
}: {
  columns: TemplateCol[];
  formData: Record<string, any>;
  setField: (k: string, v: string) => void;
}) {
  // Simple categorisation by field_key keywords
  const getGroup = (col: TemplateCol): string => {
    const k = col.field_key;
    if (/att|attend|first.?tim|convert|chop/.test(k)) return 'Attendance';
    if (/testimon|altar|bapti|wofbi|holy.?ghost|water|foundation/.test(k)) return 'Spiritual Activity';
    if (/tithe|offer|thank|kcc|shiloh|project|wsf|income/.test(k)) return 'Finance — Income';
    if (/rof|exp|expendit/.test(k)) return 'Finance — Expenditure';
    return 'Other';
  };

  const grouped: Record<string, TemplateCol[]> = {};
  for (const col of columns) {
    const g = getGroup(col);
    if (!grouped[g]) grouped[g] = [];
    grouped[g].push(col);
  }

  const ORDER = ['Attendance', 'Spiritual Activity', 'Finance — Income', 'Finance — Expenditure', 'Other'];
  const sorted = ORDER.filter(g => grouped[g]);

  return (
    <div className="space-y-4">
      {sorted.map(group => (
        <div key={group} className="card p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">{group}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {grouped[group].map(col => (
              <div key={col.field_key}>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  {col.display_label}
                  <span className="ml-1 text-gray-400 font-normal text-xs">
                    ({col.aggregation_type})
                  </span>
                </label>
                {isCurrency(col) ? (
                  <div className="flex">
                    <span className="inline-flex items-center px-2.5 text-sm text-gray-500 bg-gray-50 border border-r-0 border-gray-300 rounded-l-lg">₦</span>
                    <input
                      type="number"
                      min="0"
                      value={formData[col.field_key] ?? ''}
                      onChange={e => setField(col.field_key, e.target.value)}
                      className="input rounded-l-none"
                      placeholder="0"
                    />
                  </div>
                ) : (
                  <input
                    type="number"
                    min="0"
                    value={formData[col.field_key] ?? ''}
                    onChange={e => setField(col.field_key, e.target.value)}
                    className="input"
                    placeholder="0"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
