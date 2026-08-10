import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { C, pageStyle, glassCard, glassHeader, glassInput, badge } from '../lib/theme';

const SOURCE_LABELS: Record<string, string> = {
  manual: 'Manual', whatsapp_text: 'WhatsApp', voice: 'Voice',
  excel_import: 'Excel Import', auto_compile: 'Auto', bank_reconciliation: 'Bank',
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
        .is('deleted_at', null)
        .order('service_date', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user?.station_id,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('service_entries').update({ deleted_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-entries', user?.station_id] });
      queryClient.invalidateQueries({ queryKey: ['recent-entries', user?.station_id] });
      setDeleteId(null);
    },
  });

  const filtered = useMemo(() => {
    if (!entries) return [];
    return entries.filter((e: any) => {
      if (search) {
        const q = search.toLowerCase();
        if (!new Date(e.service_date + 'T00:00:00').toLocaleDateString().toLowerCase().includes(q) &&
          !JSON.stringify(e.data).toLowerCase().includes(q)) return false;
      }
      if (filterSource !== 'all' && e.source !== filterSource) return false;
      if (filterDateFrom && e.service_date < filterDateFrom) return false;
      if (filterDateTo && e.service_date > filterDateTo) return false;
      return true;
    });
  }, [entries, search, filterSource, filterDateFrom, filterDateTo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const hasActiveFilters = search || filterSource !== 'all' || filterDateFrom || filterDateTo;
  const clearFilters = () => { setSearch(''); setFilterSource('all'); setFilterDateFrom(''); setFilterDateTo(''); setPage(1); };

  const summarise = (data: Record<string, any>): string => {
    const pairs = Object.entries(data).filter(([, v]) => v !== '' && v !== 0 && v != null)
      .slice(0, 4).map(([k, v]) => `${k.replace(/_/g, ' ')}: ${typeof v === 'number' ? v.toLocaleString() : v}`);
    return pairs.join(' · ') || 'No data';
  };

  const selectStyle = { ...glassInput, height: 38, fontSize: 13 };

  return (
    <div style={pageStyle}>
      <div style={{ position: 'fixed', top: 0, right: 0, width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(79,70,229,0.05) 0%, transparent 70%)', filter: 'blur(120px)', pointerEvents: 'none', zIndex: 0 }} />

      <header style={{ ...glassHeader, position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button onClick={() => navigate('/dashboard')} style={{ background: 'none', border: 'none', color: C.textMuted, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
            onMouseEnter={e => (e.currentTarget.style.color = C.textPrimary)}
            onMouseLeave={e => (e.currentTarget.style.color = C.textMuted)}>
            ← Dashboard
          </button>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => navigate('/generate-report')}
              style={{ height: 36, padding: '0 16px', background: C.glassLighter, border: `1px solid ${C.border}`, borderRadius: 9, color: C.textSecondary, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
              Generate Report
            </button>
            <button onClick={() => navigate('/report/new')}
              style={{ height: 36, padding: '0 16px', background: C.accent, border: 'none', borderRadius: 9, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              + New Entry
            </button>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px', position: 'relative', zIndex: 1 }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ color: C.textPrimary, fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em' }}>Service Entries</h1>
          <p style={{ color: C.textMuted, fontSize: 13, marginTop: 4 }}>
            {isLoading ? 'Loading…' : `${filtered.length} entr${filtered.length !== 1 ? 'ies' : 'y'}${hasActiveFilters ? ' matching filters' : ''}`}
          </p>
        </div>

        {/* Filters */}
        <div style={{ ...glassCard, marginBottom: 20, padding: '16px 20px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, overflowX: 'hidden' }}>
            <div style={{ position: 'relative', flex: '1 1 200px' }}>
              <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: C.textMuted, pointerEvents: 'none' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input type="text" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search by date or data…"
                style={{ ...glassInput, height: 38, fontSize: 13, paddingLeft: 32 }}
                onFocus={e => { e.target.style.borderColor = C.borderFocus; e.target.style.boxShadow = '0 0 0 3px rgba(79,70,229,0.08)'; }}
                onBlur={e => { e.target.style.borderColor = C.border; e.target.style.boxShadow = 'none'; }} />
            </div>
            <select value={filterSource} onChange={e => { setFilterSource(e.target.value); setPage(1); }} style={selectStyle}>
              <option value="all">All sources</option>
              {Object.entries(SOURCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input type="date" value={filterDateFrom} onChange={e => { setFilterDateFrom(e.target.value); setPage(1); }} style={{ ...selectStyle, flex: '1 1 130px', minWidth: 0 }} />
            <input type="date" value={filterDateTo} onChange={e => { setFilterDateTo(e.target.value); setPage(1); }} style={{ ...selectStyle, flex: '1 1 130px', minWidth: 0 }} />
            {hasActiveFilters && (
              <button onClick={clearFilters} style={{ height: 38, padding: '0 14px', background: 'none', border: `1px solid ${C.border}`, borderRadius: 9, color: C.textMuted, fontSize: 13, cursor: 'pointer' }}>Clear</button>
            )}
          </div>
        </div>

        {/* List */}
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: C.textMuted }}>Loading entries…</div>
        ) : isError ? (
          <div style={{ ...glassCard, textAlign: 'center', color: '#FCA5A5', padding: 32 }}>Failed to load. Please refresh.</div>
        ) : paginated.length === 0 ? (
          <div style={{ ...glassCard, textAlign: 'center', padding: '60px 24px' }}>
            <p style={{ color: C.textMuted, fontSize: 14, marginBottom: 16 }}>
              {hasActiveFilters ? 'No entries match your filters.' : 'No service entries yet.'}
            </p>
            {hasActiveFilters
              ? <button onClick={clearFilters} style={{ background: 'none', border: 'none', color: C.accent, fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}>Clear filters</button>
              : <button onClick={() => navigate('/report/new')} style={{ background: C.accent, border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 600, padding: '10px 20px', cursor: 'pointer' }}>Record first entry</button>}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {paginated.map((entry: any) => (
              <div key={entry.id} onClick={() => navigate(`/entry/${entry.id}`)}
                style={{ ...glassCard, padding: '14px 18px', cursor: 'pointer', transition: 'all 0.15s', border: `1px solid ${C.border}` }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(79,70,229,0.3)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = C.border)}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                      <span style={{ color: C.textPrimary, fontSize: 14, fontWeight: 500 }}>
                        {new Date(entry.service_date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                      </span>
                      <span style={badge('gray')}>{SOURCE_LABELS[entry.source] ?? entry.source}</span>
                    </div>
                    <p style={{ color: C.textMuted, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{summarise(entry.data)}</p>
                    <p style={{ color: C.textMuted, fontSize: 11, marginTop: 2, opacity: 0.6 }}>Recorded {new Date(entry.created_at).toLocaleDateString()}</p>
                  </div>
                  <button onClick={e => { e.stopPropagation(); setDeleteId(entry.id); }}
                    style={{ background: 'none', border: 'none', color: C.textMuted, fontSize: 12, cursor: 'pointer', padding: '4px 8px', borderRadius: 6, flexShrink: 0 }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#FCA5A5')}
                    onMouseLeave={e => (e.currentTarget.style.color = C.textMuted)}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ color: C.textMuted, fontSize: 13 }}>Page {page} of {totalPages} · {filtered.length} total</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)} style={{ height: 36, padding: '0 14px', background: C.glassLighter, border: `1px solid ${C.border}`, borderRadius: 9, color: C.textSecondary, fontSize: 13, cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.4 : 1 }}>← Prev</button>
              <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} style={{ height: 36, padding: '0 14px', background: C.glassLighter, border: `1px solid ${C.border}`, borderRadius: 9, color: C.textSecondary, fontSize: 13, cursor: page === totalPages ? 'not-allowed' : 'pointer', opacity: page === totalPages ? 0.4 : 1 }}>Next →</button>
            </div>
          </div>
        )}
      </main>

      {deleteId && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)' }}>
          <div style={{ ...glassCard, maxWidth: 360, width: '100%', margin: '0 16px', padding: 28, position: 'relative' }}>
            <div style={{ position: 'absolute', top: 0, left: 16, right: 16, height: 1, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)' }} />
            <h2 style={{ color: C.textPrimary, fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Delete this entry?</h2>
            <p style={{ color: C.textMuted, fontSize: 14, marginBottom: 24 }}>The entry will be hidden from all lists.</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => deleteMutation.mutate(deleteId)} disabled={deleteMutation.isPending}
                style={{ flex: 1, height: 42, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, color: '#FCA5A5', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                {deleteMutation.isPending ? 'Deleting…' : 'Yes, delete'}
              </button>
              <button onClick={() => setDeleteId(null)}
                style={{ flex: 1, height: 42, background: C.glassLighter, border: `1px solid ${C.border}`, borderRadius: 10, color: C.textSecondary, fontSize: 14, cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
