import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { C, pageStyle, glassCard, glassHeader } from '../lib/theme';
import { formatDate } from '../utils/format';

export default function DiscrepancyFlags() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filterResolved, setFilterResolved] = useState<'all' | 'open' | 'resolved'>('open');

  const { data: flags, isLoading } = useQuery({
    queryKey: ['discrepancy-flags', user?.station_id, filterResolved],
    queryFn: async () => {
      if (!user?.station_id) return [];
      let q = supabase
        .from('discrepancy_flags')
        .select(`
          id, reported_total, bank_total, difference, resolved, created_at,
          bank_statements ( file_storage_path, station_id )
        `)
        .order('created_at', { ascending: false });

      if (filterResolved === 'open') q = q.eq('resolved', false);
      if (filterResolved === 'resolved') q = q.eq('resolved', true);

      const { data, error } = await q;
      if (error) throw error;

      // Filter to only this station's flags
      return (data ?? []).filter((f: any) =>
        f.bank_statements?.station_id === user.station_id
      );
    },
    enabled: !!user?.station_id,
  });

  const resolveMutation = useMutation({
    mutationFn: async (flagId: string) => {
      const { error } = await supabase
        .from('discrepancy_flags')
        .update({ resolved: true })
        .eq('id', flagId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discrepancy-flags'] });
    },
  });

  const openCount = (flags ?? []).filter((f: any) => !f.resolved).length;

  return (
    <div style={pageStyle}>
      <div style={{ position: 'fixed', top: 0, right: 0, width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(79,70,229,0.05) 0%, transparent 70%)', filter: 'blur(120px)', pointerEvents: 'none', zIndex: 0 }} />

      <header style={{ ...glassHeader, position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 24px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button onClick={() => navigate('/dashboard')}
            style={{ background: 'none', border: 'none', color: C.textMuted, fontSize: 14, cursor: 'pointer' }}
            onMouseEnter={e => (e.currentTarget.style.color = C.textPrimary)}
            onMouseLeave={e => (e.currentTarget.style.color = C.textMuted)}>
            ← Dashboard
          </button>
          <button onClick={() => navigate('/bank-reconciliation')}
            style={{ height: 36, padding: '0 16px', background: C.accent, border: 'none', borderRadius: 9, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            + New Reconciliation
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 900, margin: '0 auto', padding: '32px 24px 60px', position: 'relative', zIndex: 1 }}>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
            <h1 style={{ color: C.textPrimary, fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em' }}>Discrepancy Flags</h1>
            {openCount > 0 && (
              <span style={{ padding: '2px 10px', borderRadius: 6, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', color: '#FCA5A5', fontSize: 12, fontWeight: 600 }}>
                {openCount} open
              </span>
            )}
          </div>
          <p style={{ color: C.textMuted, fontSize: 13 }}>
            Differences between reported income and bank statement totals.
          </p>
        </div>

        {/* Filter */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {(['open', 'resolved', 'all'] as const).map(f => (
            <button key={f} onClick={() => setFilterResolved(f)}
              style={{
                padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500,
                cursor: 'pointer', border: '1px solid', transition: 'all 0.15s',
                background: filterResolved === f ? 'rgba(79,70,229,0.15)' : 'rgba(255,255,255,0.04)',
                borderColor: filterResolved === f ? 'rgba(79,70,229,0.5)' : C.border,
                color: filterResolved === f ? '#A5B4FC' : C.textSecondary,
                textTransform: 'capitalize',
              }}>
              {f}
            </button>
          ))}
        </div>

        {/* List */}
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: C.textMuted }}>Loading…</div>
        ) : !flags?.length ? (
          <div style={{ ...glassCard, textAlign: 'center', padding: '60px 24px' }}>
            <p style={{ color: C.textMuted, fontSize: 14 }}>
              {filterResolved === 'open' ? 'No open discrepancies. All reconciled!' : 'No discrepancy flags found.'}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {flags.map((flag: any) => {
              const diff = flag.difference ?? Math.abs(flag.reported_total - flag.bank_total);
              const isLarge = diff >= 100;
              const accentColor = flag.resolved ? '#4ADE80' : isLarge ? '#FCA5A5' : '#FDE68A';
              const accentBg = flag.resolved ? 'rgba(34,197,94,0.08)' : isLarge ? 'rgba(239,68,68,0.08)' : 'rgba(234,179,8,0.08)';
              const accentBorder = flag.resolved ? 'rgba(34,197,94,0.2)' : isLarge ? 'rgba(239,68,68,0.2)' : 'rgba(234,179,8,0.2)';

              return (
                <div key={flag.id} style={{ ...glassCard, padding: '18px 22px', border: `1px solid ${accentBorder}` }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>

                    {/* Left: amounts */}
                    <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                      <div>
                        <p style={{ color: C.textMuted, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Reported</p>
                        <p style={{ color: C.textPrimary, fontSize: 18, fontWeight: 700 }}>₦{Number(flag.reported_total).toLocaleString()}</p>
                      </div>
                      <div>
                        <p style={{ color: C.textMuted, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Bank Total</p>
                        <p style={{ color: C.textPrimary, fontSize: 18, fontWeight: 700 }}>₦{Number(flag.bank_total).toLocaleString()}</p>
                      </div>
                      <div>
                        <p style={{ color: C.textMuted, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Difference</p>
                        <p style={{ color: accentColor, fontSize: 18, fontWeight: 700 }}>₦{Number(diff).toLocaleString()}</p>
                      </div>
                    </div>

                    {/* Right: status + date + action */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                      <span style={{ padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: accentBg, color: accentColor, border: `1px solid ${accentBorder}` }}>
                        {flag.resolved ? 'Resolved' : isLarge ? 'Significant' : 'Minor'}
                      </span>
                      <p style={{ color: C.textMuted, fontSize: 12 }}>{formatDate(flag.created_at)}</p>
                      {!flag.resolved && (
                        <button
                          onClick={() => resolveMutation.mutate(flag.id)}
                          disabled={resolveMutation.isPending}
                          style={{ height: 32, padding: '0 14px', background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 8, color: '#4ADE80', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                          {resolveMutation.isPending ? '…' : 'Mark resolved'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
