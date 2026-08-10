import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => currentYear - i);

const CLASS_LABELS: Record<string, string> = {
  bcc: 'BCC — Basic Christian Course',
  lcc: 'LCC — Leadership Christian Course',
  ldc: 'LDC — Leadership Development Course',
};

export default function WofbiEntry() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Attendance values keyed by class
  const [attendance, setAttendance] = useState<Record<string, string>>({
    bcc: '', lcc: '', ldc: '',
  });
  const [notes, setNotes] = useState('');

  // Month string for DB (always 1st of month)
  const monthStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`;

  // ── fetch existing entries for selected month ─────────────
  const { data: existing, isLoading } = useQuery({
    queryKey: ['wofbi-entries', user?.station_id, monthStr],
    queryFn: async () => {
      if (!user?.station_id) return [];
      const { data, error } = await supabase
        .from('wofbi_entries')
        .select('id, wofbi_class, attendance, notes')
        .eq('station_id', user.station_id)
        .eq('month', monthStr)
        .is('deleted_at', null);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user?.station_id,
  });

  // Pre-fill form from existing entries when data loads
  const existingByClass: Record<string, any> = {};
  (existing ?? []).forEach((e: any) => { existingByClass[e.wofbi_class] = e; });

  // ── determine which classes this station runs ─────────────
  const { data: stationData } = useQuery({
    queryKey: ['station-wofbi', user?.station_id],
    queryFn: async () => {
      if (!user?.station_id) return null;
      const { data } = await supabase
        .from('stations')
        .select('wofbi_class')
        .eq('id', user.station_id)
        .single();
      return data;
    },
    enabled: !!user?.station_id,
  });

  // If station has a specific class, only show that one; else show all 3
  const activeClasses: string[] = stationData?.wofbi_class && stationData.wofbi_class !== 'none'
    ? [stationData.wofbi_class]
    : ['bcc', 'lcc', 'ldc'];

  // ── save/update mutation ──────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user?.station_id) throw new Error('Not authenticated');

      const upserts = activeClasses
        .filter(cls => attendance[cls] !== '' && attendance[cls] !== undefined)
        .map(cls => ({
          station_id: user.station_id,
          month: monthStr,
          wofbi_class: cls,
          attendance: Number(attendance[cls]) || 0,
          notes: notes.trim() || null,
          entered_by: user.id,
        }));

      if (upserts.length === 0) throw new Error('Enter attendance for at least one class.');

      const { error } = await supabase
        .from('wofbi_entries')
        .upsert(upserts, { onConflict: 'station_id,month,wofbi_class' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wofbi-entries', user?.station_id, monthStr] });
      setSuccessMsg(`WOFBI entry for ${MONTHS[selectedMonth]} ${selectedYear} saved.`);
      setTimeout(() => setSuccessMsg(null), 4000);
    },
    onError: (err: any) => setErrorMsg(err.message || 'Failed to save.'),
  });

  // Pre-fill attendance state from DB when month changes
  const prefillFromExisting = () => {
    const filled: Record<string, string> = { bcc: '', lcc: '', ldc: '' };
    (existing ?? []).forEach((e: any) => {
      filled[e.wofbi_class] = String(e.attendance);
    });
    setAttendance(filled);
    const firstNote = (existing ?? []).find((e: any) => e.notes)?.notes ?? '';
    setNotes(firstNote);
  };

  // Pre-fill attendance state from DB when existing data loads or month changes
  useEffect(() => {
    prefillFromExisting();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing]);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <button onClick={() => navigate('/dashboard')} className="btn btn-ghost text-sm">
            ← Back to Dashboard
          </button>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">WOFBI Attendance</h1>
          <p className="text-sm text-gray-500 mt-1">
            Record monthly Word of Faith Bible Institute attendance per class.
          </p>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 flex justify-between">
            <span>{errorMsg}</span>
            <button onClick={() => setErrorMsg(null)}>✕</button>
          </div>
        )}
        {successMsg && (
          <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-700">
            {successMsg}
          </div>
        )}

        {/* Month / Year picker */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Select Month</h2>
          <div className="flex flex-wrap gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Month</label>
              <select
                value={selectedMonth}
                onChange={e => {
                  setSelectedMonth(Number(e.target.value));
                  setAttendance({ bcc: '', lcc: '', ldc: '' });
                  setNotes('');
                }}
                className="input text-sm"
              >
                {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Year</label>
              <select
                value={selectedYear}
                onChange={e => {
                  setSelectedYear(Number(e.target.value));
                  setAttendance({ bcc: '', lcc: '', ldc: '' });
                  setNotes('');
                }}
                className="input text-sm"
              >
                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>

          {/* Show existing entries for this month */}
          {!isLoading && existing && existing.length > 0 && (
            <div className="mt-3 p-2.5 rounded-lg bg-indigo-50 border border-indigo-100 text-xs text-indigo-700 flex items-center justify-between">
              <span>Entry already saved for {MONTHS[selectedMonth]} {selectedYear}. Saving will update it.</span>
              <button onClick={prefillFromExisting} className="underline font-medium ml-2">Load saved values</button>
            </div>
          )}
        </div>

        {/* Attendance fields */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Attendance by Class</h2>
          <div className="space-y-4">
            {activeClasses.map(cls => (
              <div key={cls}>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {CLASS_LABELS[cls] ?? cls.toUpperCase()}
                </label>
                <input
                  type="number"
                  min="0"
                  value={attendance[cls] ?? ''}
                  onChange={e => setAttendance(prev => ({ ...prev, [cls]: e.target.value }))}
                  className="input max-w-xs"
                  placeholder="0"
                />
                {existingByClass[cls] && attendance[cls] === '' && (
                  <p className="text-xs text-gray-400 mt-1">
                    Last saved: {existingByClass[cls].attendance}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div className="card p-5">
          <label className="block text-sm font-semibold text-gray-900 mb-2">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            className="input"
            placeholder="Any remarks about this month's WOFBI class…"
          />
        </div>

        {/* Save */}
        <div className="flex gap-3">
          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="btn btn-primary flex-1 text-base"
          >
            {saveMutation.isPending ? 'Saving…' : `Save ${MONTHS[selectedMonth]} ${selectedYear} Entry`}
          </button>
          <button onClick={() => navigate('/dashboard')} className="btn btn-secondary">
            Cancel
          </button>
        </div>
      </main>
    </div>
  );
}
