import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';

export default function BankReconciliation() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [ocrResult, setOcrResult] = useState<any>(null);
  const [processing, setProcessing] = useState(false);
  const [reportedTotal, setReportedTotal] = useState<number | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file || !user?.station_id) return;

    setUploading(true);
    try {
      const fileName = `${Date.now()}_${file.name}`;
      const { data, error } = await supabase
        .storage
        .from('bank-statements')
        .upload(fileName, file);

      if (error) throw error;

      // Store the bank statement record (without OCR)
      const { error: insertError } = await supabase
        .from('bank_statements')
        .insert({
          station_id: user.station_id,
          file_storage_path: data.path,
          ocr_raw_text: null,
          parsed_total: null,
        });

      if (insertError) throw insertError;

      // Set OCR result with just the file path for manual review
      setOcrResult({
        success: true,
        file_path: data.path,
        ocr_text: null,
        total_candidates: [],
        confidence: 'manual',
        matches: [],
      });
    } catch (error) {
      console.error('Error uploading bank statement:', error);
      alert('Failed to upload bank statement. Please try again.');
    } finally {
      setUploading(false);
      setProcessing(false);
    }
  };

  const handleConfirmTotal = async (total: number) => {
    if (!user?.station_id || !ocrResult) return;

    try {
      // Update the bank statement with confirmed total
      const { error } = await supabase
        .from('bank_statements')
        .update({ 
          parsed_total: total,
          confirmed_by: user.id,
        })
        .eq('station_id', user.station_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) throw error;

      alert('Bank statement total confirmed successfully!');
      navigate('/dashboard');
    } catch (error) {
      console.error('Error confirming total:', error);
      alert('Failed to confirm total. Please try again.');
    }
  };

  const calculateDifference = () => {
    if (reportedTotal && ocrResult?.total_candidates?.length > 0) {
      const bankTotal = ocrResult.total_candidates[0];
      return Math.abs(reportedTotal - bankTotal);
    }
    return null;
  };

  const difference = calculateDifference();

  // Manual entry mode if OCR failed or was skipped
  const isManualMode = !ocrResult?.ocr_text || ocrResult?.confidence === 'manual';

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="text-sm text-gray-600 hover:text-gray-900 font-medium"
          >
            ← Back to Dashboard
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Bank Statement Reconciliation</h1>
          <p className="text-sm text-gray-600 mt-1">Upload and reconcile bank statements with reported totals</p>
        </div>

        {!ocrResult ? (
          <div className="bg-white shadow rounded-lg p-6 space-y-6">
            <div>
              <h2 className="text-lg font-medium text-gray-900 mb-4">Upload Bank Statement</h2>
              <p className="text-sm text-gray-600 mb-4">
                Upload your bank statement (image or PDF) to extract the total amount for reconciliation.
              </p>
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={handleFileSelect}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
              />
              {file && (
                <p className="mt-2 text-sm text-gray-600">
                  Selected: {file.name}
                </p>
              )}
            </div>

            <button
              onClick={handleUpload}
              disabled={!file || uploading || processing}
              className="w-full px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? 'Uploading...' : processing ? 'Processing...' : 'Upload & Process'}
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Manual Entry or OCR Results */}
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">
                {isManualMode ? 'Enter Bank Statement Total' : 'OCR Results'}
              </h2>
              
              {isManualMode ? (
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">
                    OCR is not available. Please manually enter the total amount from your bank statement.
                  </p>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Total Amount (₦)
                    </label>
                    <input
                      type="number"
                      value={reportedTotal || ''}
                      onChange={(e) => setReportedTotal(parseFloat(e.target.value) || 0)}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="Enter total amount"
                    />
                  </div>
                </div>
              ) : (
                <>
                  <div className="mb-4">
                    <p className="text-sm text-gray-600 mb-2">Detected Total Amounts:</p>
                    <div className="space-y-2">
                      {ocrResult.total_candidates?.map((total: number, index: number) => (
                        <div
                          key={index}
                          className={`p-3 border rounded-md cursor-pointer ${
                            ocrResult.total_candidates[0] === total
                              ? 'border-indigo-500 bg-indigo-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                          onClick={() => setReportedTotal(total)}
                        >
                          <p className="text-lg font-medium text-gray-900">
                            ₦{total.toLocaleString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {ocrResult.matches?.length > 0 && (
                    <div className="mt-4">
                      <p className="text-sm text-gray-600 mb-2">Matched Text:</p>
                      <div className="bg-gray-50 p-3 rounded max-h-40 overflow-y-auto">
                        {ocrResult.matches.map((match: string, index: number) => (
                          <p key={index} className="text-xs text-gray-700 font-mono">
                            {match}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Reported Total Input */}
            {!isManualMode && (
              <div className="bg-white shadow rounded-lg p-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">Enter Reported Total</h2>
                <p className="text-sm text-gray-600 mb-4">
                  Enter the total amount from your report for comparison.
                </p>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reported Total (₦)</label>
                  <input
                    type="number"
                    value={reportedTotal || ''}
                    onChange={(e) => setReportedTotal(Number(e.target.value))}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>
            )}

            {/* Reconciliation Result */}
            {reportedTotal && !isManualMode && difference !== null && (
              <div className={`bg-white shadow rounded-lg p-6 ${
                difference === 0 
                  ? 'border-2 border-green-500' 
                  : difference < 100 
                  ? 'border-2 border-yellow-500'
                  : 'border-2 border-red-500'
              }`}>
                <h2 className="text-lg font-medium text-gray-900 mb-4">Reconciliation Result</h2>
                
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Reported Total:</span>
                    <span className="text-sm font-medium text-gray-900">₦{reportedTotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Bank Statement Total:</span>
                    <span className="text-sm font-medium text-gray-900">
                      ₦{(ocrResult.total_candidates[0] || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between border-t pt-3">
                    <span className="text-sm font-medium text-gray-900">Difference:</span>
                    <span className={`text-sm font-bold ${
                      difference === 0 
                        ? 'text-green-600' 
                        : difference < 100 
                        ? 'text-yellow-600'
                        : 'text-red-600'
                    }`}>
                      ₦{difference.toLocaleString()}
                    </span>
                  </div>
                </div>

                {difference === 0 ? (
                  <div className="mt-4 p-3 bg-green-50 rounded-md">
                    <p className="text-sm text-green-800 font-medium">✓ Perfect Match!</p>
                    <p className="text-xs text-green-700">The reported total matches the bank statement.</p>
                  </div>
                ) : difference < 100 ? (
                  <div className="mt-4 p-3 bg-yellow-50 rounded-md">
                    <p className="text-sm text-yellow-800 font-medium">⚠ Minor Discrepancy</p>
                    <p className="text-xs text-yellow-700">Small difference detected. Please verify manually.</p>
                  </div>
                ) : (
                  <div className="mt-4 p-3 bg-red-50 rounded-md">
                    <p className="text-sm text-red-800 font-medium">✗ Significant Discrepancy</p>
                    <p className="text-xs text-red-700">Large difference detected. Please review both amounts carefully.</p>
                  </div>
                )}
              </div>
            )}

            {/* Manual Mode - Just confirm the total */}
            {isManualMode && reportedTotal && (
              <div className="bg-white shadow rounded-lg p-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">Confirm Bank Statement Total</h2>
                <p className="text-sm text-gray-600 mb-4">
                  Confirm the total amount from your bank statement.
                </p>
                <div className="flex justify-between border-t pt-3">
                  <span className="text-sm font-medium text-gray-900">Bank Statement Total:</span>
                  <span className="text-sm font-bold text-indigo-600">
                    ₦{reportedTotal.toLocaleString()}
                  </span>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-4">
              <button
                onClick={() => handleConfirmTotal(reportedTotal || (isManualMode ? 0 : ocrResult.total_candidates[0]))}
                disabled={!reportedTotal}
                className="flex-1 px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Confirm Total
              </button>
              <button
                onClick={() => setOcrResult(null)}
                className="flex-1 px-6 py-3 border border-gray-300 text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Upload New Statement
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
