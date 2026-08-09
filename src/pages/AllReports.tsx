import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';

const SOURCE_LABELS: Record<string, string> = {
  manual: 'Manual',
  whatsapp_text: 'WhatsApp',
  voice: 'Voice',
  excel_import: 'Excel Import',
  auto_compile: 'Auto',
  bank_reconciliation: 'Bank',
};

const PAGE_SIZE = 20;

export default function AllReports() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [filterSource, setFilterSource] = useState('all');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: entries, isLoading, isError } = useQuery({
    queryKey: ['all-entries', user?.station_id],
    queryFn: async () => {
      if (!user?.station_id) return [];
      const { data, error } = await supabase
        .from('service_entries')
        .select('id, service_date, data, source, created_at, entered_by')
        .eq('station_id', user.station_id)
        .order('service_date', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user?.station_id,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('service_entries').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-entries', user?.station_id] });
      queryClient.invalidateQueries({ queryKey: ['recent-entries', user?.station_id] });
      setDeleteId(null);
    },
  });

  // ── client-side filter ───────────────────────────────────
  const filtered = useMemo(() => {
    if (!entries) return [];
    return entries.filter((e: any) => {
      if (search) {
        const q = search.toLowerCase();
        const dateStr = new Date(e.service_date + 'T00:00:00').toLocaleDateString().toLowerCase();
        const dataStr = JSON.stringify(e.data).toLowerCase();
        if (!dateStr.includes(q) && !dataStr.includes(q)) return false;
      }
      if (filterSource !== 'all' && e.source !== filterSource) return false;
      if (filterDateFrom && e.service_date < filterDateFrom) return false;
      if (filterDateTo && e.service_date > filterDateTo) return false;
      return true;
    });
  }, [entries, search, filterSource, filterDateFrom, filterDateTo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleFilterChange = (fn: () => void) => { fn(); setPage(1); };
  const clearFilters = () => { setSearch(''); setFilterSource('all'); setFilterDateFrom(''); setFilterDateTo(''); setPage(1); };
  const hasActiveFilters = search || filterSource !== 'all' || filterDateFrom || filterDateTo;

  // Summarise a data blob into a readable line
  const summarise = (data: Record<string, any>): string => {
    const pairs = Object.entries(data)
      .filter(([, v]) => v !== '' && v !== 0 && v != null)
      .slice(0, 4)
      .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${typeof v === 'number' ? v.toLocaleString() : v}`);
    return pairs.join(' · ') || 'No data';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <button onClick={() => navigate('/dashboard')} className="btn btn-ghost text-sm">
            ← Back to Dashboard
          </button>
          <div className="flex gap-2">
            <button onClick={() => navigate('/generate-report')} className="btn btn-secondary text-sm">
              Generate Report
            </button>
            <button onClick={() => navigate('/report/new')} className="btn btn-primary text-sm">
              + New Entry
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Service Entries</h1>
          <p className="text-sm text-gray-500 mt-1">
            {isLoading ? 'Loading…' : `${filtered.length} entr${filtered.length !== 1 ? 'ies' : 'y'}${hasActiveFilters ? ' matching filters' : ''}`}
          </p>
        </div>

        {/* Filters */}
        <div className="card p-4 mb-6 space-y-4">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={e => handleFilterChange(() => setSearch(e.target.value))}
              placeholder="Search by date or data…"
              className="input pl-9"
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Source</label>
              <select value={filterSource} onChange={e => handleFilterChange(() => setFilterSource(e.target.value))} className="input text-sm py-1.5">
                <option value="all">All sources</option>
                {Object.entries(SOURCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">From date</label>
              <input type="date" value={filterDateFrom} onChange={e => handleFilterChange(() => setFilterDateFrom(e.target.value))} className="input text-sm py-1.5" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">To date</label>
              <input type="date" value={filterDateTo} onChange={e => handleFilterChange(() => setFilterDateTo(e.target.value))} className="input text-sm py-1.5" />
            </div>
            {hasActiveFilters && (
              <div className="flex items-end">
                <button onClick={clearFilters} className="btn btn-ghost text-sm text-gray-500 py-1.5">Clear</button>
              </div>
            )}
          </div>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="text-center py-12 text-gray-400">Loading entries…</div>
        ) : isError ? (
          <div className="card p-6 text-center text-red-500 text-sm">Failed to load. Please refresh.</div>
        ) : paginated.length === 0 ? (
          <div className="card p-10 text-center">
            <p className="text-gray-400 text-sm">
              {hasActiveFilters ? 'No entries match your filters.' : 'No service entries yet.'}
            </p>
            {hasActiveFilters
              ? <button onClick={clearFilters} className="mt-3 text-sm text-indigo-600 hover:underline">Clear filters</button>
              : <button onClick={() => navigate('/report/new')} className="mt-3 btn btn-primary text-sm">Record first entry</button>
            }
          </div>
        ) : (
          <div className="space-y-2">
            {paginated.map((entry: any) => (
              <div key={entry.id} className="card p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-900">
                        {new Date(entry.service_date + 'T00:00:00').toLocaleDateString('en-GB', {
                          weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                        })}
                      </p>
                      <span className="badge badge-neutral text-xs">
                        {SOURCE_LABELS[entry.source] ?? entry.source}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1 truncate">
                      {summarise(entry.data)}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Recorded {new Date(entry.created_at).toLocaleDateString()}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => setDeleteId(entry.id)}
                      className="btn btn-ghost text-xs text-gray-400 hover:text-red-500"
                      title="Delete entry"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* Expanded data preview */}
                <details className="mt-3">
                  <summary className="text-xs text-indigo-500 cursor-pointer select-none">Show all fields</summary>
                  <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                    {Object.entries(entry.data)
                      .filter(([, v]) => v !== '' && v !== 0 && v != null)
                      .map(([k, v]) => (
                        <div key={k} className="bg-gray-50 rounded p-2">
                          <p className="text-xs text-gray-400 capitalize">{k.replace(/_/g, ' ')}</p>
                          <p className="text-sm font-medium text-gray-900">
                            {typeof v === 'number' ? v.toLocaleString() : String(v)}
                          </p>
                        </div>
                      ))}
                  </div>
                </details>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between">
            <p className="text-sm text-gray-500">Page {page} of {totalPages} · {filtered.length} total</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn btn-secondary text-sm disabled:opacity-40">← Prev</button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="btn btn-secondary text-sm disabled:opacity-40">Next →</button>
            </div>
          </div>
        )}
      </main>

      {/* Delete confirmation modal */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <h2 className="text-base font-semibold text-gray-900 mb-2">Delete this entry?</h2>
            <p className="text-sm text-gray-500 mb-6">
              This service entry will be permanently deleted and cannot be recovered.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => deleteMutation.mutate(deleteId)}
                disabled={deleteMutation.isPending}
                className="btn btn-danger flex-1"
              >
                {deleteMutation.isPending ? 'Deleting…' : 'Yes, delete'}
              </button>
              <button onClick={() => setDeleteId(null)} className="btn btn-secondary flex-1">Cancel</button>
            </div>
            {deleteMutation.isError && (
              <p className="mt-3 text-xs text-red-500">{(deleteMutation.error as any)?.message}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
