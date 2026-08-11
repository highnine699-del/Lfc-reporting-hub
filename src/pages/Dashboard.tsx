import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { C, pageStyle, glassCard, glassHeader, badge } from '../lib/theme';

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const { data: recentEntries, isLoading } = useQuery({
    queryKey: ['recent-entries', user?.station_id],
    queryFn: async () => {
      if (!user?.station_id) return [];
      const { data, error } = await supabase
        .from('service_entries')
        .select('id, service_date, data, source, created_at')
        .eq('station_id', user.station_id)
        .is('deleted_at', null)
        .order('service_date', { ascending: false })
        .limit(8);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user?.station_id,
  });

  const { data: childStations } = useQuery({
    queryKey: ['child-stations', user?.station_id],
    queryFn: async () => {
      if (!user?.station_id) return [];
      const { data, error } = await supabase.from('stations').select('id').eq('parent_station_id', user.station_id).limit(1);
      if (error) return [];
      return data ?? [];
    },
    enabled: !!user?.station_id,
  });

  const { data: stationInfo } = useQuery({
    queryKey: ['station-info', user?.station_id],
    queryFn: async () => {
      if (!user?.station_id) return null;
      const { data } = await supabase.from('stations').select('wofbi_class').eq('id', user.station_id).single();
      return data;
    },
    enabled: !!user?.station_id,
  });

  const hasChildStations = (childStations?.length ?? 0) > 0;
  const hasWofbi = stationInfo?.wofbi_class && stationInfo.wofbi_class !== 'none';

  const getTrialDaysRemaining = () => {
    if (!user || user.subscription_status !== 'trial') return null;
    return Math.ceil((new Date(user.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  };
  const trialDays = getTrialDaysRemaining();

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const summariseEntry = (data: Record<string, any>): string => {
    const parts: string[] = [];
    const att = (data.adults_male_attendance ?? 0) + (data.adults_female_attendance ?? 0) + (data.avg_att_d ?? data.avg_attendance ?? 0);
    if (att > 0) parts.push(`${att} att.`);
    const income = data.income ?? data.offerings ?? data.tithes ?? 0;
    if (income > 0) parts.push(`₦${Number(income).toLocaleString()}`);
    if (parts.length === 0) {
      const filled = Object.values(data).filter(v => v !== '' && v !== 0 && v != null).length;
      return `${filled} field${filled !== 1 ? 's' : ''} recorded`;
    }
    return parts.join(' · ');
  };

  const SOURCE_LABELS: Record<string, string> = {
    manual: 'Manual', whatsapp_text: 'WhatsApp', voice: 'Voice',
    excel_import: 'Excel Import', auto_compile: 'Auto',
  };

  const features = [
    { title: 'Record Service Entry', desc: 'Log data for a single service', path: 'M12 4v16m8-8H4', onClick: () => navigate('/report/new') },
    { title: 'All Entries', desc: 'Browse, search and filter', path: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2', onClick: () => navigate('/reports') },
    { title: 'Generate Report', desc: 'Compile entries into Excel', path: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', onClick: () => navigate('/generate-report') },
    { title: 'Bank Reconciliation', desc: 'Upload and reconcile statements', path: 'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z', onClick: () => navigate('/bank-reconciliation') },
    { title: 'Discrepancy Flags', desc: 'Review bank reconciliation issues', path: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z', onClick: () => navigate('/discrepancies') },
    ...(hasWofbi ? [{ title: 'WOFBI Attendance', desc: 'Monthly bible school records', path: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253', onClick: () => navigate('/wofbi') }] : []),
    ...(hasChildStations ? [{ title: 'Sub-Station Entries', desc: 'View entries from your stations', path: 'M3 7h18M3 12h18M3 17h18', onClick: () => navigate('/station-reports') }] : []),
    ...(user?.role === 'pastor' ? [{ title: 'Manage Delegates', desc: 'Add or remove delegates', path: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z', onClick: () => navigate('/delegates') }] : []),
    ...(user?.role === 'admin' ? [{ title: 'Template Mapping', desc: 'Upload and configure templates', path: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', onClick: () => navigate('/admin/templates') }] : []),
    { title: 'Settings', desc: 'Profile, station, subscription', path: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z', onClick: () => navigate('/settings') },
  ];

  const dashGridCss = '.dash-grid{display:grid;grid-template-columns:minmax(0,1fr);gap:24px;align-items:start}@media(min-width:768px){.dash-grid{grid-template-columns:minmax(0,1fr) 320px}}';

  return (
    <div style={pageStyle}>
      {/* Ambient glows */}
      <div style={{ position: 'fixed', top: 0, right: 0, width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(79,70,229,0.06) 0%, transparent 70%)', filter: 'blur(120px)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'fixed', bottom: 0, left: 0, width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(79,70,229,0.03) 0%, transparent 70%)', filter: 'blur(100px)', pointerEvents: 'none', zIndex: 0 }} />

      {/* Header */}
      <header style={{ ...glassHeader, position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <span style={{ color: C.textPrimary, fontWeight: 700, fontSize: 18, letterSpacing: '0.08em' }}>LFC</span>
            <span style={{ color: C.textMuted, fontSize: 11, letterSpacing: '0.14em', marginLeft: 8, fontWeight: 500 }}>REPORTING HUB</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ color: C.textMuted, fontSize: 13 }}>{user?.full_name}</span>
            <button onClick={signOut} style={{ background: 'none', border: `1px solid ${C.border}`, color: C.textMuted, borderRadius: 8, padding: '6px 14px', fontSize: 13, cursor: 'pointer' }}
              onMouseEnter={e => (e.currentTarget.style.color = C.textPrimary)}
              onMouseLeave={e => (e.currentTarget.style.color = C.textMuted)}>
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px', position: 'relative', zIndex: 1 }}>

        {/* Subscription banner */}
        {user?.subscription_status === 'expired' && (
          <div style={{ marginBottom: 24, padding: '14px 18px', borderRadius: 12, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ color: '#FCA5A5', fontSize: 14 }}>Your subscription has expired.</span>
            <button onClick={() => navigate('/settings')} style={{ color: C.accent, fontSize: 13, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Renew now →</button>
          </div>
        )}
        {user?.subscription_status === 'trial' && trialDays !== null && trialDays <= 7 && (
          <div style={{ marginBottom: 24, padding: '14px 18px', borderRadius: 12, background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.18)' }}>
            <span style={{ color: '#FDE68A', fontSize: 14 }}>Trial ending in {trialDays} day{trialDays !== 1 ? 's' : ''}. <button onClick={() => navigate('/settings')} style={{ color: C.accent, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Upgrade →</button></span>
          </div>
        )}

        {/* Greeting + primary actions */}
        <div style={{ marginBottom: 36 }}>
          <h1 style={{ color: C.textPrimary, fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 20 }}>
            {getGreeting()}, {user?.full_name?.split(' ')[0] ?? 'there'}
          </h1>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button
              onClick={() => user?.subscription_status === 'expired' ? navigate('/settings') : navigate('/report/new')}
              style={{ flex: '1 1 160px', height: 46, padding: '0 24px', background: C.accent, border: 'none', borderRadius: 12, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.background = C.accentHover)}
              onMouseLeave={e => (e.currentTarget.style.background = C.accent)}
            >+ Record Service Entry</button>
            <button
              onClick={() => navigate('/generate-report')}
              style={{ flex: '1 1 140px', height: 46, padding: '0 24px', background: C.glassLighter, border: `1px solid ${C.border}`, borderRadius: 12, color: C.textPrimary, fontSize: 14, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
              onMouseLeave={e => (e.currentTarget.style.background = C.glassLighter)}
            >Generate Report</button>
          </div>
        </div>

        {/* Recent entries + feature grid — single col on mobile, 2-col on tablet+ */}
        <style>{dashGridCss}</style>
        <div className="dash-grid">

          {/* Recent entries */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h2 style={{ color: C.textPrimary, fontSize: 16, fontWeight: 600 }}>Recent Service Entries</h2>
              <button onClick={() => navigate('/reports')} style={{ color: C.accent, fontSize: 13, fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer' }}>View all →</button>
            </div>

            {isLoading ? (
              <div style={{ ...glassCard, textAlign: 'center', color: C.textMuted, padding: 40 }}>Loading…</div>
            ) : recentEntries && recentEntries.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {recentEntries.map((entry: any) => (
                  <button key={entry.id} onClick={() => navigate(`/entry/${entry.id}`)}
                    style={{ ...glassCard, padding: '14px 18px', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, transition: 'all 0.15s', border: `1px solid ${C.border}` }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(79,70,229,0.3)')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = C.border)}>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ color: C.textPrimary, fontSize: 14, fontWeight: 500, marginBottom: 3 }}>
                        {new Date(entry.service_date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                      <p style={{ color: C.textMuted, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {summariseEntry(entry.data)}
                      </p>
                    </div>
                    <span style={badge('gray')}>{SOURCE_LABELS[entry.source] ?? entry.source}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div style={{ ...glassCard, textAlign: 'center', padding: '48px 24px' }}>
                <p style={{ color: C.textMuted, fontSize: 14, marginBottom: 16 }}>No entries yet.</p>
                <button onClick={() => navigate('/report/new')}
                  style={{ background: C.accent, border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 600, padding: '10px 20px', cursor: 'pointer' }}>
                  Record your first entry
                </button>
              </div>
            )}
          </div>

          {/* Feature grid */}
          <div>
            <h2 style={{ color: C.textPrimary, fontSize: 16, fontWeight: 600, marginBottom: 14 }}>Features</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {features.map(f => (
                <button key={f.title} onClick={f.onClick}
                  style={{ ...glassCard, padding: '12px 16px', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, transition: 'all 0.15s', border: `1px solid ${C.border}` }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(79,70,229,0.3)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = C.border)}>
                  <div style={{ width: 36, height: 36, borderRadius: 9, background: 'rgba(79,70,229,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="16" height="16" fill="none" stroke="#818CF8" strokeWidth={1.8} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d={f.path} />
                    </svg>
                  </div>
                  <div>
                    <p style={{ color: C.textPrimary, fontSize: 13, fontWeight: 500 }}>{f.title}</p>
                    <p style={{ color: C.textMuted, fontSize: 11, marginTop: 1 }}>{f.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
