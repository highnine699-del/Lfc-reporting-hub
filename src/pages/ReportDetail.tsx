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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Report not found</div>
      </div>
    );
  }

  const currentVersion = report.report_versions.find((v: any) => v.id === report.current_version_id) || report.report_versions[0];
  const allVersions = report.report_versions.sort((a: any, b: any) => 
    new Date(b.server_timestamp).getTime() - new Date(a.server_timestamp).getTime()
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            ← Back to Dashboard
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {report.templates?.name || `${report.period_type.charAt(0).toUpperCase() + report.period_type.slice(1)} Report`}
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                {new Date(report.period_start).toLocaleDateString()} - {new Date(report.period_end).toLocaleDateString()}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                report.status === 'finalized' 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-yellow-100 text-yellow-800'
              }`}>
                {report.status === 'finalized' ? 'Finalized' : 'Draft'}
              </span>
              {report.status === 'draft' && (
                <button
                  onClick={handleFinalizeReport}
                  disabled={finalizeReportMutation.isPending}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm disabled:opacity-50"
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
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'current'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Current Version
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
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
            <div className="bg-white shadow rounded-lg p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-lg font-medium text-gray-900">Current Version</h2>
                  <p className="text-sm text-gray-500">
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
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm"
                    >
                      Download Excel
                    </button>
                  ) : (
                    <button
                      onClick={() => currentVersion && handleGenerateReport(currentVersion.id)}
                      disabled={generateReportMutation.isPending}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm disabled:opacity-50"
                    >
                      {generateReportMutation.isPending ? 'Generating...' : 'Generate Excel'}
                    </button>
                  )}
                </div>
              </div>

              {/* Data Display */}
              {currentVersion && (
                <div className="mt-6 space-y-4">
                  <h3 className="text-md font-medium text-gray-900">Report Data</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {Object.entries(currentVersion.data).map(([key, value]) => (
                      <div key={key} className="bg-gray-50 p-3 rounded">
                        <p className="text-xs text-gray-500 uppercase">{key.replace(/_/g, ' ')}</p>
                        <p className="text-sm font-medium text-gray-900">
                          {typeof value === 'number' ? value.toLocaleString() : String(value)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : activeTab === 'history' ? (
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Version History</h3>
              <div className="space-y-4">
                {allVersions.map((version: any) => (
                  <div key={version.id} className="border-b border-gray-200 pb-4 last:border-0">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
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
                          className="text-sm text-indigo-600 hover:text-indigo-800"
                        >
                          Download
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white shadow rounded-lg p-6">
            <p className="text-gray-500">No versions available</p>
          </div>
        )}
      </main>
    </div>
  );
}