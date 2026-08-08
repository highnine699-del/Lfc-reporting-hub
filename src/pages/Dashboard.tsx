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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">LFC Reporting Hub</h1>
          <button
            onClick={signOut}
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Sign Out
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Subscription Banner */}
        {user && (
          <div className={`mb-6 p-4 rounded-md ${
            user.subscription_status === 'expired' 
              ? 'bg-red-50 border border-red-200' 
              : trialDays !== null && trialDays <= 7
              ? 'bg-yellow-50 border border-yellow-200'
              : 'bg-green-50 border border-green-200'
          }`}>
            {user.subscription_status === 'trial' && trialDays !== null ? (
              <p className="text-sm">
                <span className="font-medium">Trial Period:</span> {trialDays} days remaining
              </p>
            ) : user.subscription_status === 'expired' ? (
              <p className="text-sm font-medium text-red-800">
                Your subscription has expired. Please renew to continue.
              </p>
            ) : (
              <p className="text-sm">
                <span className="font-medium">Subscription:</span> Active
              </p>
            )}
          </div>
        )}

        {/* Quick Actions */}
        <div className="mb-8">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h2>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => navigate('/report/new')}
              className="px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Create New Report
            </button>
            <button
              onClick={() => navigate('/bank-reconciliation')}
              className="px-6 py-3 border border-gray-300 text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Bank Reconciliation
            </button>
          </div>
        </div>

        {/* Recent Reports */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Recent Reports</h2>
            
            {isLoading ? (
              <div className="text-center py-8">
                <div className="text-gray-500">Loading reports...</div>
              </div>
            ) : reports && reports.length > 0 ? (
              <div className="space-y-4">
                {reports.map((report: any) => (
                  <div
                    key={report.id}
                    onClick={() => navigate(`/report/${report.id}`)}
                    className="p-4 border border-gray-200 rounded-md hover:bg-gray-50 cursor-pointer"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-sm font-medium text-gray-900">
                          {report.period_type.charAt(0).toUpperCase() + report.period_type.slice(1)} Report
                        </h3>
                        <p className="text-sm text-gray-500">
                          {new Date(report.period_start).toLocaleDateString()} - {new Date(report.period_end).toLocaleDateString()}
                        </p>
                      </div>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        report.current_version_id ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {report.current_version_id ? 'Completed' : 'Draft'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="text-gray-500">No reports yet. Create your first report!</div>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <div className="mt-8">
          <h2 className="text-lg font-medium text-gray-900 mb-4">All Features</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Reports Section */}
            <button
              onClick={() => navigate('/report/new')}
              className="p-4 border border-gray-200 rounded-md hover:bg-gray-50 text-left bg-indigo-50 border-indigo-200"
            >
              <h3 className="text-sm font-medium text-gray-900">Create New Report</h3>
              <p className="text-sm text-gray-500">Start a new report</p>
            </button>

            {/* Delegates Section */}
            <button
              onClick={() => navigate('/delegates')}
              className="p-4 border border-gray-200 rounded-md hover:bg-gray-50 text-left"
            >
              <h3 className="text-sm font-medium text-gray-900">Manage Delegates</h3>
              <p className="text-sm text-gray-500">Add or remove delegate accounts</p>
            </button>

            {/* Bank Reconciliation */}
            <button
              onClick={() => navigate('/bank-reconciliation')}
              className="p-4 border border-gray-200 rounded-md hover:bg-gray-50 text-left"
            >
              <h3 className="text-sm font-medium text-gray-900">Bank Reconciliation</h3>
              <p className="text-sm text-gray-500">Upload and reconcile bank statements</p>
            </button>

            {/* Template Mapping - Admin Only */}
            {user?.role === 'admin' && (
              <button
                onClick={() => navigate('/admin/templates')}
                className="p-4 border border-gray-200 rounded-md hover:bg-gray-50 text-left bg-purple-50 border-purple-200"
              >
                <h3 className="text-sm font-medium text-gray-900">Template Mapping</h3>
                <p className="text-sm text-gray-500">Configure Excel templates</p>
              </button>
            )}

            {/* Settings */}
            <button
              onClick={() => navigate('/settings')}
              className="p-4 border border-gray-200 rounded-md hover:bg-gray-50 text-left"
            >
              <h3 className="text-sm font-medium text-gray-900">Settings</h3>
              <p className="text-sm text-gray-500">Profile and subscription settings</p>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
