import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export default function ReportDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'current' | 'history'>('current');

  const { data: report, isLoading } = useQuery({
    queryKey: ['report', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('reports')
        .select(`
          *,
          report_versions (
            id,
            data,
            server_timestamp,
            edited_by,
            source,
            generated_file_path,
            created_at,
            users (
              full_name
            )
          ),
          templates (
            name,
            period_type
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const finalizeReportMutation = useMutation({
    mutationFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('reports')
        .update({ 
          status: 'finalized',
          finalized_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report', id] });
      alert('Report finalized successfully!');
    },
  });

  const handleFinalizeReport = async () => {
    try {
      await finalizeReportMutation.mutateAsync();
    } catch (error) {
      console.error('Error finalizing report:', error);
      alert('Failed to finalize report. Please try again.');
    }
  };

  const generateReportMutation = useMutation({
    mutationFn: async (reportVersionId: string) => {
      const { data, error } = await supabase.functions.invoke('generate-report', {
        body: { report_version_id: reportVersionId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report', id] });
    },
  });

  const handleGenerateReport = async (versionId: string) => {
    try {
      await generateReportMutation.mutateAsync(versionId);
      alert('Report generated successfully!');
    } catch (error) {
      console.error('Error generating report:', error);
      alert('Failed to generate report. Please try again.');
    }
  };

  const handleDownload = async (filePath: string) => {
    try {
      const { data, error } = await supabase
        .storage
        .from('generated-reports')
        .createSignedUrl(filePath, 60);

      if (error) throw error;

      const link = document.createElement('a');
      link.href = data.signedUrl;
      link.download = filePath;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error downloading file:', error);
      alert('Failed to download file.');
    }
  };

  const formatCurrency = (value: any) => {
    if (typeof value !== 'number') return '₦0';
    return `₦${value.toLocaleString()}`;
  };

  const renderDataDisplay = (data: Record<string, any>) => {
    return (
      <div className="space-y-8">
        {/* Attendance Section */}
        <div className="card p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Attendance</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {[
              { key: 'adults_male_attendance', label: 'Adult Male' },
              { key: 'adults_female_attendance', label: 'Adult Female' },
              { key: 'children_male_attendance', label: 'Children Male' },
              { key: 'children_female_attendance', label: 'Children Female' },
              { key: 'children_attendance', label: 'Children (Combined)' },
              { key: 'first_timers', label: 'First Timers' },
              { key: 'new_converts', label: 'New Converts' },
            ].map(({ key, label }) => data[key] !== undefined && (
              <div key={key} className="bg-gray-50 p-4 rounded-lg">
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {typeof data[key] === 'number' ? data[key].toLocaleString() : data[key]}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Spiritual Activity Section */}
        <div className="card p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Spiritual Activity</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {[
              { key: 'testimonies', label: 'Testimonies' },
              { key: 'altar_calls', label: 'Altar Calls' },
              { key: 'wofbi_attendance', label: 'WOFBI Attendance' },
              { key: 'water_baptisms', label: 'Water Baptisms' },
              { key: 'holy_ghost_baptisms', label: 'Holy Ghost Baptisms' },
            ].map(({ key, label }) => data[key] !== undefined && (
              <div key={key} className="bg-gray-50 p-4 rounded-lg">
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {typeof data[key] === 'number' ? data[key].toLocaleString() : data[key]}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Finance Income Section */}
        <div className="card p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Finance — Income</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {[
              { key: 'tithes', label: 'Tithes' },
              { key: 'offerings', label: 'Offerings' },
              { key: 'thanksgiving', label: 'Thanksgiving' },
              { key: 'kcc', label: 'KCC' },
              { key: 'shiloh_sacrifice', label: 'Shiloh Sacrifice' },
              { key: 'project_funds', label: 'Project Funds' },
            ].map(({ key, label }) => data[key] !== undefined && (
              <div key={key} className="bg-gray-50 p-4 rounded-lg">
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {formatCurrency(data[key])}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Expenditure Section */}
        {data.expenditure_items && data.expenditure_items.length > 0 && (
          <div className="card p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-4">Finance — Expenditure (ROF)</h3>
            <div className="space-y-3">
              {data.expenditure_items.map((item: any, index: number) => (
                <div key={index} className="flex justify-between items-center bg-gray-50 p-4 rounded-lg">
                  <span className="text-sm text-gray-900">{item.label || 'Item'}</span>
                  <span className="text-lg font-semibold text-gray-900">
                    {formatCurrency(item.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Additional Fields */}
        {Object.keys(data).filter(key => 
          !['adults_male_attendance', 'adults_female_attendance', 'children_male_attendance', 
            'children_female_attendance', 'first_timers', 'new_converts', 'testimonies', 
            'altar_calls', 'wofbi_attendance', 'water_baptisms', 'holy_ghost_baptisms',
            'tithes', 'offerings', 'thanksgiving', 'kcc', 'shiloh_sacrifice', 'project_funds',
            'total', 'total_attendance', 'expenditure_items'].includes(key)
        ).length > 0 && (
          <div className="card p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-4">Additional Data</h3>
            <div className="grid grid-cols-2 gap-4">
              {Object.keys(data).filter(key => 
                !['adults_male_attendance', 'adults_female_attendance', 'children_male_attendance', 
                  'children_female_attendance', 'first_timers', 'new_converts', 'testimonies', 
                  'altar_calls', 'wofbi_attendance', 'water_baptisms', 'holy_ghost_baptisms',
                  'tithes', 'offerings', 'thanksgiving', 'kcc', 'shiloh_sacrifice', 'project_funds',
                  'total', 'total_attendance', 'expenditure_items'].includes(key)
              ).map(key => (
                <div key={key} className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{key.replace(/_/g, ' ')}</p>
                  <p className="text-sm font-medium text-gray-900">
                    {typeof data[key] === 'number' ? data[key].toLocaleString() : String(data[key])}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Report not found</div>
      </div>
    );
  }

  const currentVersion = report.report_versions.find((v: any) => v.id === report.current_version_id) || report.report_versions[0];
  const allVersions = report.report_versions.sort((a: any, b: any) => 
    new Date(b.server_timestamp).getTime() - new Date(a.server_timestamp).getTime()
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="btn btn-ghost text-sm"
          >
            ← Back to Dashboard
          </button>
        </div>
      </header>

      <main className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">
                {report.templates?.name || `${report.period_type.charAt(0).toUpperCase() + report.period_type.slice(1)} Report`}
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                {new Date(report.period_start).toLocaleDateString()} - {new Date(report.period_end).toLocaleDateString()}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`badge ${
                report.status === 'finalized' ? 'badge-success' : 'badge-warning'
              }`}>
                {report.status === 'finalized' ? 'Finalized' : 'Draft'}
              </span>
              {report.status === 'draft' && (
                <button
                  onClick={handleFinalizeReport}
                  disabled={finalizeReportMutation.isPending}
                  className="btn btn-primary text-sm"
                >
                  {finalizeReportMutation.isPending ? 'Finalizing...' : 'Finalize Report'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('current')}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'current'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Current Version
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'history'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Version History ({allVersions.length})
            </button>
          </nav>
        </div>

        {activeTab === 'current' && (currentVersion || allVersions.length > 0) ? (
          <div className="space-y-6">
            {/* Current Version */}
            <div className="card p-6">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Current Version</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Last edited by {currentVersion?.users?.full_name || 'Unknown'} on{' '}
                    {currentVersion ? new Date(currentVersion.server_timestamp).toLocaleString() : 'N/A'}
                  </p>
                  <p className="text-sm text-gray-500">
                    Source: {currentVersion?.source || 'N/A'}
                  </p>
                </div>
                <div className="flex gap-2">
                  {currentVersion?.generated_file_path ? (
                    <button
                      onClick={() => handleDownload(currentVersion.generated_file_path)}
                      className="btn btn-success text-sm"
                    >
                      Download Excel
                    </button>
                  ) : (
                    <button
                      onClick={() => currentVersion && handleGenerateReport(currentVersion.id)}
                      disabled={generateReportMutation.isPending}
                      className="btn btn-primary text-sm"
                    >
                      {generateReportMutation.isPending ? 'Generating...' : 'Generate Excel'}
                    </button>
                  )}
                </div>
              </div>

              {/* Data Display */}
              {currentVersion && renderDataDisplay(currentVersion.data)}
            </div>
          </div>
        ) : activeTab === 'history' ? (
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Version History</h3>
            <div className="space-y-6">
              {allVersions.map((version: any, index: number) => (
                <div key={version.id} className="relative pb-6 last:pb-0">
                  {index !== allVersions.length - 1 && (
                    <div className="absolute left-4 top-10 bottom-0 w-px bg-gray-200"></div>
                  )}
                  <div className="flex gap-4">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      version.id === report.current_version_id
                        ? 'bg-indigo-100 text-indigo-600'
                        : 'bg-gray-100 text-gray-500'
                    }`}>
                      {version.id === report.current_version_id ? (
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <span className="text-xs font-medium">{index + 1}</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            Version {allVersions.length - index}
                            {version.id === report.current_version_id && (
                              <span className="ml-2 badge badge-success text-xs">Current</span>
                            )}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            Edited by {version.users?.full_name || 'Unknown'}
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(version.server_timestamp).toLocaleString()}
                          </p>
                          <p className="text-xs text-gray-500">
                            Source: {version.source}
                          </p>
                        </div>
                        {version.generated_file_path && (
                          <button
                            onClick={() => handleDownload(version.generated_file_path)}
                            className="btn btn-ghost text-sm"
                          >
                            Download Excel
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="card p-6">
            <p className="text-gray-500">No versions available</p>
          </div>
        )}
      </main>
    </div>
  );
}
