import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const { data: reports, isLoading } = useQuery({
    queryKey: ['reports', user?.station_id],
    queryFn: async () => {
      if (!user?.station_id) return [];
      const { data, error } = await supabase
        .from('reports')
        .select(`
          *,
          report_versions (
            id,
            data,
            server_timestamp,
            edited_by,
            source
          )
        `)
        .eq('station_id', user.station_id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.station_id,
  });

  const getTrialDaysRemaining = () => {
    if (!user || user.subscription_status !== 'trial') return null;
    const trialEnd = new Date(user.trial_ends_at);
    const now = new Date();
    const diff = trialEnd.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const trialDays = getTrialDaysRemaining();

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-xl font-semibold text-gray-900">LFC Reporting Hub</h1>
          <button
            onClick={signOut}
            className="btn btn-ghost text-sm"
          >
            Sign Out
          </button>
        </div>
      </header>

      <main className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Subscription Banner */}
        {user && (
          <div className={`mb-6 p-4 rounded-lg border ${
            user.subscription_status === 'expired' 
              ? 'bg-red-50 border-red-200' 
              : trialDays !== null && trialDays <= 7
              ? 'bg-yellow-50 border-yellow-200'
              : 'bg-green-50 border-green-200'
          }`}>
            {user.subscription_status === 'trial' && trialDays !== null ? (
              <p className="text-sm">
                <span className="font-medium text-gray-800">Trial Period:</span> {trialDays} days remaining
              </p>
            ) : user.subscription_status === 'expired' ? (
              <p className="text-sm font-medium text-red-800">
                Your subscription has expired. Please renew to continue.
              </p>
            ) : (
              <p className="text-sm">
                <span className="font-medium text-gray-800">Subscription:</span> Active
              </p>
            )}
          </div>
        )}

        {/* Greeting and Quick Actions */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">
            {getGreeting()}, {user?.full_name?.split(' ')[0] || 'there'}
          </h2>
          <div className="flex flex-wrap gap-3 mt-4">
            <button
              onClick={() => navigate('/report/new')}
              className="btn btn-primary text-base"
            >
              + New Report
            </button>
            <button
              onClick={() => navigate('/bank-reconciliation')}
              className="btn btn-secondary text-base"
            >
              Bank Reconciliation
            </button>
          </div>
        </div>

        {/* Recent Reports */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Reports</h3>
          
          {isLoading ? (
            <div className="text-center py-8">
              <div className="text-gray-500">Loading reports...</div>
            </div>
          ) : reports && reports.length > 0 ? (
            <div className="space-y-3">
              {reports.map((report: any) => (
                <div
                  key={report.id}
                  onClick={() => navigate(`/report/${report.id}`)}
                  className="card p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-sm font-medium text-gray-900">
                        {report.period_type.charAt(0).toUpperCase() + report.period_type.slice(1)} Report
                      </h4>
                      <p className="text-sm text-gray-500 mt-1">
                        {new Date(report.period_start).toLocaleDateString()} - {new Date(report.period_end).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`badge ${
                        report.current_version_id ? 'badge-success' : 'badge-neutral'
                      }`}>
                        {report.current_version_id ? 'Finalized' : 'Draft'}
                      </span>
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 card">
              <div className="text-gray-500">No reports yet. Create your first report!</div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">All Features</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Reports Section */}
            <button
              onClick={() => navigate('/report/new')}
              className="card p-4 hover:bg-gray-50 text-left transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-900">Create New Report</h4>
                  <p className="text-sm text-gray-500 mt-1">Start a new report</p>
                </div>
              </div>
            </button>

            {/* Delegates Section */}
            <button
              onClick={() => navigate('/delegates')}
              className="card p-4 hover:bg-gray-50 text-left transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-900">Manage Delegates</h4>
                  <p className="text-sm text-gray-500 mt-1">Add or remove delegate accounts</p>
                </div>
              </div>
            </button>

            {/* Bank Reconciliation */}
            <button
              onClick={() => navigate('/bank-reconciliation')}
              className="card p-4 hover:bg-gray-50 text-left transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-900">Bank Reconciliation</h4>
                  <p className="text-sm text-gray-500 mt-1">Upload and reconcile bank statements</p>
                </div>
              </div>
            </button>

            {/* Template Mapping - Admin Only */}
            {user?.role === 'admin' && (
              <button
                onClick={() => navigate('/admin/templates')}
                className="card p-4 hover:bg-gray-50 text-left transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-900">Template Mapping</h4>
                    <p className="text-sm text-gray-500 mt-1">Configure Excel templates</p>
                  </div>
                </div>
              </button>
            )}

            {/* Settings */}
            <button
              onClick={() => navigate('/settings')}
              className="card p-4 hover:bg-gray-50 text-left transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-900">Settings</h4>
                  <p className="text-sm text-gray-500 mt-1">Profile and subscription settings</p>
                </div>
              </div>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}