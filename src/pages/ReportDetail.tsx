import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import ManualReportForm from '../components/ManualReportForm';

export default function ReportDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'current' | 'history'>('current');
  const [isEditing, setIsEditing] = useState(false);
  // Task 14 — finalize confirmation
  const [showFinalizeConfirm, setShowFinalizeConfirm] = useState(false);
  // Task 22 — archive confirmation
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [inlineSuccess, setInlineSuccess] = useState<string | null>(null);

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
            period_type,
            current_version_id
          )
        `)
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Task 5 — new version mutation
  const editMutation = useMutation({
    mutationFn: async (newData: Record<string, any>) => {
      if (!id || !user) throw new Error('Not authenticated');

      // Task 24 — Optimistic locking: re-fetch the current version ID just before saving.
      // If it changed since we opened the edit form, someone else saved a version and
      // we should warn the user rather than silently overwriting.
      const { data: freshReport, error: fetchError } = await supabase
        .from('reports')
        .select('current_version_id')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      if (
        freshReport?.current_version_id &&
        report?.current_version_id &&
        freshReport.current_version_id !== report.current_version_id
      ) {
        throw new Error(
          'CONFLICT: This report was edited by someone else while you were making changes. ' +
          'Please close this form, review the latest version, and try again.'
        );
      }

      const { data: version, error: versionError } = await supabase
        .from('report_versions')
        .insert({
          report_id: id,
          template_version_id: report?.templates?.current_version_id ?? null,
          data: newData,
          edited_by: user.id,
          source: 'manual',
        })
        .select('id')
        .single();

      if (versionError) throw versionError;

      // Point the report at the new version
      const { error: updateError } = await supabase
        .from('reports')
        .update({ current_version_id: version.id })
        .eq('id', id);

      if (updateError) throw updateError;
      return version;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report', id] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      setIsEditing(false);
      setInlineSuccess('New version saved successfully.');
      setTimeout(() => setInlineSuccess(null), 4000);
    },
    onError: (err: any) => {
      setInlineError(err.message || 'Failed to save changes. Please try again.');
    },
  });

  const finalizeReportMutation = useMutation({
    mutationFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('reports')
        .update({ status: 'finalized', finalized_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report', id] });
      setShowFinalizeConfirm(false);
      setInlineSuccess('Report finalized successfully.');
      setTimeout(() => setInlineSuccess(null), 4000);
    },
    onError: (err: any) => {
      setShowFinalizeConfirm(false);
      setInlineError(err.message || 'Failed to finalize report. Please try again.');
    },
  });

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
      setInlineSuccess('Excel file generated. Click Download to save it.');
      setTimeout(() => setInlineSuccess(null), 5000);
    },
    onError: (err: any) => {
      // Task 9 — better error message when no template is mapped
      const msg: string = err.message || '';
      if (msg.includes('no template') || msg.includes('no versions') || msg.includes('no file storage')) {
        setInlineError(
          'No Excel template has been mapped for this report type. An admin needs to upload and configure a template under Admin → Template Mapping before a file can be generated.'
        );
      } else {
        setInlineError(msg || 'Failed to generate Excel file. Please try again.');
      }
    },
  });

  // Task 22 — archive mutation (soft-delete)
  const archiveMutation = useMutation({
    mutationFn: async () => {
      if (!id) return;
      const { error } = await supabase
        .from('reports')
        .update({ archived_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      queryClient.invalidateQueries({ queryKey: ['all-reports'] });
      navigate('/dashboard');
    },
    onError: (err: any) => {
      setShowArchiveConfirm(false);
      setInlineError(err.message || 'Failed to archive report. Please try again.');
    },
  });

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
    } catch (error: any) {
      setInlineError('Failed to download file: ' + (error.message || ''));
    }
  };

  const formatCurrency = (value: any) => {
    if (typeof value !== 'number') return '₦0';
    return `₦${value.toLocaleString()}`;
  };

  const renderDataDisplay = (data: Record<string, any>) => (
    <div className="space-y-8">
      {/* Attendance */}
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

      {/* Spiritual Activity */}
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

      {/* Finance Income */}
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
              <p className="text-2xl font-semibold text-gray-900">{formatCurrency(data[key])}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Finance Expenditure */}
      {data.expenditure_items && data.expenditure_items.length > 0 && (
        <div className="card p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Finance — Expenditure (ROF)</h3>
          <div className="space-y-3">
            {data.expenditure_items.map((item: any, index: number) => (
              <div key={index} className="flex justify-between items-center bg-gray-50 p-4 rounded-lg">
                <span className="text-sm text-gray-900">{item.label || 'Item'}</span>
                <span className="text-lg font-semibold text-gray-900">{formatCurrency(item.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Additional Fields */}
      {(() => {
        const knownKeys = [
          'adults_male_attendance', 'adults_female_attendance', 'children_male_attendance',
          'children_female_attendance', 'children_attendance', 'first_timers', 'new_converts',
          'testimonies', 'altar_calls', 'wofbi_attendance', 'water_baptisms', 'holy_ghost_baptisms',
          'tithes', 'offerings', 'thanksgiving', 'kcc', 'shiloh_sacrifice', 'project_funds',
          'total', 'total_attendance', 'expenditure_items',
        ];
        const extraKeys = Object.keys(data).filter(k => !knownKeys.includes(k));
        if (extraKeys.length === 0) return null;
        return (
          <div className="card p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-4">Additional Data</h3>
            <div className="grid grid-cols-2 gap-4">
              {extraKeys.map(key => (
                <div key={key} className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{key.replace(/_/g, ' ')}</p>
                  <p className="text-sm font-medium text-gray-900">
                    {typeof data[key] === 'number' ? data[key].toLocaleString() : String(data[key])}
                  </p>
                </div>
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Report not found.</div>
      </div>
    );
  }

  const currentVersion =
    report.report_versions.find((v: any) => v.id === report.current_version_id) ||
    report.report_versions[0];
  const allVersions = [...report.report_versions].sort(
    (a: any, b: any) => new Date(b.server_timestamp).getTime() - new Date(a.server_timestamp).getTime()
  );

  // Task 5 — show the edit form (pre-filled) instead of normal view
  if (isEditing && currentVersion) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <button onClick={() => setIsEditing(false)} className="btn btn-ghost text-sm">
              ← Cancel Edit
            </button>
          </div>
        </header>
        <main className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-gray-900">Edit Report</h1>
            <p className="text-sm text-gray-500 mt-1">
              Saving will create a new version — previous versions are preserved in history.
            </p>
          </div>
          {editMutation.isPending ? (
            <div className="text-center py-8 text-gray-500">Saving new version...</div>
          ) : (
            <ManualReportForm
              periodType={report.period_type}
              startDate={report.period_start}
              endDate={report.period_end}
              initialData={currentVersion.data}
              onSubmit={(data) => editMutation.mutate(data)}
              onCancel={() => setIsEditing(false)}
            />
          )}
          {inlineError && (
            <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
              {inlineError}
            </div>
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <button onClick={() => navigate('/dashboard')} className="btn btn-ghost text-sm">
            ← Back to Dashboard
          </button>
        </div>
      </header>

      <main className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Inline banners */}
        {inlineError && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
            {inlineError}
            <button onClick={() => setInlineError(null)} className="ml-2 underline text-xs">Dismiss</button>
          </div>
        )}
        {inlineSuccess && (
          <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-700">
            {inlineSuccess}
          </div>
        )}

        {/* Header row */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">
                {report.templates?.name ||
                  `${report.period_type.charAt(0).toUpperCase() + report.period_type.slice(1)} Report`}
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                {new Date(report.period_start).toLocaleDateString()} –{' '}
                {new Date(report.period_end).toLocaleDateString()}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`badge ${report.status === 'finalized' ? 'badge-success' : 'badge-warning'}`}>
                {report.status === 'finalized' ? 'Finalized' : 'Draft'}
              </span>

              {/* Task 5 — Edit button (only while draft) */}
              {report.status !== 'finalized' && (
                <button
                  onClick={() => { setIsEditing(true); setInlineError(null); }}
                  className="btn btn-secondary text-sm"
                >
                  Edit Report
                </button>
              )}

              {/* Task 14 — Finalize with confirmation */}
              {report.status !== 'finalized' && (
                <button
                  onClick={() => setShowFinalizeConfirm(true)}
                  className="btn btn-primary text-sm"
                >
                  Finalize Report
                </button>
              )}

              {/* Task 22 — Archive (soft-delete) */}
              {!report.archived_at && (
                <button
                  onClick={() => setShowArchiveConfirm(true)}
                  className="btn btn-ghost text-sm text-gray-400 hover:text-red-500"
                  title="Archive this report"
                >
                  Archive
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Task 14 — Confirmation modal */}
        {showFinalizeConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
              <h2 className="text-base font-semibold text-gray-900 mb-2">Finalize this report?</h2>
              <p className="text-sm text-gray-500 mb-6">
                Once finalized, the report can no longer be edited. This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => finalizeReportMutation.mutate()}
                  disabled={finalizeReportMutation.isPending}
                  className="btn btn-primary flex-1"
                >
                  {finalizeReportMutation.isPending ? 'Finalizing...' : 'Yes, finalize'}
                </button>
                <button
                  onClick={() => setShowFinalizeConfirm(false)}
                  className="btn btn-secondary flex-1"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Task 22 — Archive confirmation modal */}
        {showArchiveConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
              <h2 className="text-base font-semibold text-gray-900 mb-2">Archive this report?</h2>
              <p className="text-sm text-gray-500 mb-6">
                Archived reports are hidden from all lists but not deleted. You can still access them directly via their URL.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => archiveMutation.mutate()}
                  disabled={archiveMutation.isPending}
                  className="btn btn-danger flex-1"
                >
                  {archiveMutation.isPending ? 'Archiving...' : 'Yes, archive'}
                </button>
                <button
                  onClick={() => setShowArchiveConfirm(false)}
                  className="btn btn-secondary flex-1"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="flex space-x-8">
            {(['current', 'history'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === tab
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
              >
                {tab === 'current' ? 'Current Version' : `Version History (${allVersions.length})`}
              </button>
            ))}
          </nav>
        </div>

        {activeTab === 'current' && (
          <div className="space-y-6">
            {!currentVersion ? (
              <div className="card p-8 text-center">
                <p className="text-gray-400 text-sm">No report data yet.</p>
                <p className="text-xs text-gray-400 mt-1">
                  Use the Edit button above to add data to this report.
                </p>
              </div>
            ) : (
              <div className="card p-6">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-6">
                  <div>
                    <h2 className="text-base font-semibold text-gray-900">Current Version</h2>
                    <p className="text-sm text-gray-500 mt-1">
                      Last edited by {currentVersion?.users?.full_name || 'Unknown'} on{' '}
                      {currentVersion
                        ? new Date(currentVersion.server_timestamp).toLocaleString()
                        : 'N/A'}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Source:{' '}
                      <span className="capitalize">
                        {currentVersion?.source?.replace(/_/g, ' ') || 'N/A'}
                      </span>
                      {currentVersion?.source === 'auto_compile' && (
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                          Auto-compiled
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {currentVersion?.generated_file_path ? (
                      <button
                        onClick={() => handleDownload(currentVersion.generated_file_path)}
                        className="btn btn-secondary text-sm"
                      >
                        Download Excel
                      </button>
                    ) : (
                      <button
                        onClick={() => currentVersion && generateReportMutation.mutate(currentVersion.id)}
                        disabled={generateReportMutation.isPending}
                        className="btn btn-primary text-sm"
                      >
                        {generateReportMutation.isPending ? 'Generating...' : 'Generate Excel'}
                      </button>
                    )}
                  </div>
                </div>

                {currentVersion && renderDataDisplay(currentVersion.data)}
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="card p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-6">Version History</h3>
            {allVersions.length === 0 ? (
              <p className="text-sm text-gray-400">No versions yet.</p>
            ) : (
              <div className="space-y-6">
                {allVersions.map((version: any, index: number) => (
                  <div key={version.id} className="relative pb-6 last:pb-0">
                    {index !== allVersions.length - 1 && (
                      <div className="absolute left-4 top-10 bottom-0 w-px bg-gray-200" />
                    )}
                    <div className="flex gap-4">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${version.id === report.current_version_id
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
                              {version.source === 'auto_compile' && (
                                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                                  Auto-compiled
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              By {version.users?.full_name || 'Unknown'}
                            </p>
                            <p className="text-xs text-gray-400">
                              {new Date(version.server_timestamp).toLocaleString()}
                            </p>
                            <p className="text-xs text-gray-400 capitalize">
                              Source: {version.source?.replace(/_/g, ' ')}
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
            )}
          </div>
        )}
      </main>
    </div>
  );
}
