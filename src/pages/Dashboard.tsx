import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  // Recent service entries for this station
  const { data: recentEntries, isLoading } = useQuery({
    queryKey: ['recent-entries', user?.station_id],
    queryFn: async () => {
      if (!user?.station_id) return [];
      const { data, error } = await supabase
        .from('service_entries')
        .select('id, service_date, data, source, created_at')
        .eq('station_id', user.station_id)
        .order('service_date', { ascending: false })
        .limit(8);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user?.station_id,
  });

  // Check if this station has child stations (supervisor view)
  const { data: childStations } = useQuery({
    queryKey: ['child-stations', user?.station_id],
    queryFn: async () => {
      if (!user?.station_id) return [];
      const { data, error } = await supabase
        .from('stations')
        .select('id')
        .eq('parent_station_id', user.station_id)
        .limit(1);
      if (error) return [];
      return data ?? [];
    },
    enabled: !!user?.station_id,
  });

  const hasChildStations = (childStations?.length ?? 0) > 0;

  const getTrialDaysRemaining = () => {
    if (!user || user.subscription_status !== 'trial') return null;
    const diff = new Date(user.trial_ends_at).getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };
  const trialDays = getTrialDaysRemaining();

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  };

  // Summarise a service entry's data into a short readable line
  const summariseEntry = (data: Record<string, any>): string => {
    const parts: string[] = [];
    const attendance =
      (data.adults_male_attendance ?? 0) +
      (data.adults_female_attendance ?? 0) +
      (data.avg_att_d ?? data.avg_attendance ?? 0);
    if (attendance > 0) parts.push(`${attendance} att.`);
    const income = data.income ?? data.offerings ?? data.tithes ?? 0;
    if (income > 0) parts.push(`₦${Number(income).toLocaleString()}`);
    if (parts.length === 0) {
      // Just show count of fields filled
      const filled = Object.values(data).filter(v => v !== '' && v !== 0 && v != null).length;
      return `${filled} field${filled !== 1 ? 's' : ''} recorded`;
    }
    return parts.join(' · ');
  };

  const sourceLabel: Record<string, string> = {
    manual: 'Manual',
    whatsapp_text: 'WhatsApp',
    voice: 'Voice',
    excel_import: 'Excel Import',
    auto_compile: 'Auto',
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-xl font-semibold text-gray-900">LFC Reporting Hub</h1>
          <button onClick={signOut} className="btn btn-ghost text-sm">Sign Out</button>
        </div>
      </header>

      <main className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Subscription banner */}
        {user && (
          <div className={`mb-6 p-4 rounded-lg border ${user.subscription_status === 'expired'
              ? 'bg-red-50 border-red-200'
              : trialDays !== null && trialDays <= 7
                ? 'bg-yellow-50 border-yellow-200'
                : 'bg-green-50 border-green-200'
            }`}>
            {user.subscription_status === 'trial' && trialDays !== null ? (
              <p className="text-sm">
                <span className="font-medium text-gray-800">Trial Period:</span> {trialDays} day{trialDays !== 1 ? 's' : ''} remaining
              </p>
            ) : user.subscription_status === 'expired' ? (
              <p className="text-sm font-medium text-red-800">
                Your subscription has expired. <button onClick={() => navigate('/settings')} className="underline">Renew now</button>
              </p>
            ) : (
              <p className="text-sm"><span className="font-medium text-gray-800">Subscription:</span> Active</p>
            )}
          </div>
        )}

        {/* Greeting + primary actions */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            {getGreeting()}, {user?.full_name?.split(' ')[0] || 'there'}
          </h2>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => user?.subscription_status === 'expired' ? navigate('/settings') : navigate('/report/new')}
              className="btn btn-primary text-base"
            >
              + Record Service Entry
            </button>
            <button
              onClick={() => navigate('/generate-report')}
              className="btn btn-secondary text-base"
            >
              Generate Report
            </button>
          </div>
        </div>

        {/* Recent service entries */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Recent Service Entries</h3>
            <button
              onClick={() => navigate('/reports')}
              className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
            >
              View all →
            </button>
          </div>

          {isLoading ? (
            <div className="text-center py-8 text-gray-400">Loading…</div>
          ) : recentEntries && recentEntries.length > 0 ? (
            <div className="space-y-2">
              {recentEntries.map((entry: any) => (
                <div
                  key={entry.id}
                  className="card p-4 flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      {new Date(entry.service_date + 'T00:00:00').toLocaleDateString('en-GB', {
                        weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
                      })}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">
                      {summariseEntry(entry.data)}
                    </p>
                  </div>
                  <span className="badge badge-neutral text-xs flex-shrink-0">
                    {sourceLabel[entry.source] ?? entry.source}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="card p-8 text-center">
              <p className="text-gray-400 text-sm">No entries yet.</p>
              <button
                onClick={() => navigate('/report/new')}
                className="mt-3 btn btn-primary text-sm"
              >
                Record your first service entry
              </button>
            </div>
          )}
        </div>

        {/* Feature grid */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">All Features</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

            {/* Record entry */}
            <FeatureCard
              title="Record Service Entry"
              desc="Log data for a single service"
              iconPath="M12 4v16m8-8H4"
              onClick={() => navigate('/report/new')}
            />

            {/* View all entries */}
            <FeatureCard
              title="All Service Entries"
              desc="Browse, search and filter"
              iconPath="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              onClick={() => navigate('/reports')}
            />

            {/* Generate report */}
            <FeatureCard
              title="Generate Report"
              desc="Compile entries into Excel template"
              iconPath="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              onClick={() => navigate('/generate-report')}
            />

            {/* Bank reconciliation */}
            <FeatureCard
              title="Bank Reconciliation"
              desc="Upload and reconcile bank statements"
              iconPath="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
              onClick={() => navigate('/bank-reconciliation')}
            />

            {/* Sub-station reports — supervisors only */}
            {hasChildStations && (
              <FeatureCard
                title="Sub-Station Reports"
                desc="View entries from stations under you"
                iconPath="M3 7h18M3 12h18M3 17h18"
                onClick={() => navigate('/station-reports')}
              />
            )}

            {/* Delegates — pastors only */}
            {user?.role === 'pastor' && (
              <FeatureCard
                title="Manage Delegates"
                desc="Add or remove delegate accounts"
                iconPath="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                onClick={() => navigate('/delegates')}
              />
            )}

            {/* Template mapping — admins only */}
            {user?.role === 'admin' && (
              <FeatureCard
                title="Template Mapping"
                desc="Upload and configure Excel templates"
                iconPath="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                onClick={() => navigate('/admin/templates')}
              />
            )}

            {/* Settings */}
            <FeatureCard
              title="Settings"
              desc="Profile, station and subscription"
              iconPath="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              onClick={() => navigate('/settings')}
            />

          </div>
        </div>
      </main>
    </div>
  );
}

// ── small reusable feature card ──────────────────────────────
function FeatureCard({ title, desc, iconPath, onClick }: {
  title: string; desc: string; iconPath: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="card p-4 hover:bg-gray-50 text-left transition-colors"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={iconPath} />
          </svg>
        </div>
        <div>
          <h4 className="text-sm font-medium text-gray-900">{title}</h4>
          <p className="text-sm text-gray-500 mt-0.5">{desc}</p>
        </div>
      </div>
    </button>
  );
}
