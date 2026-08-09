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
  const [reportedTotal, setReportedTotal] = useState<number | ''>('');
  // bankStatementId is captured after upload so we can update + link discrepancy_flags
  const [bankStatementId, setBankStatementId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setErrorMsg(null);
    }
  };

  const handleUpload = async () => {
    if (!file || !user?.station_id) return;

    setUploading(true);
    setErrorMsg(null);
    try {
      const fileName = `${user.station_id}/${Date.now()}_${file.name}`;
      const { data: storageData, error: storageError } = await supabase
        .storage
        .from('bank-statements')
        .upload(fileName, file);

      if (storageError) throw storageError;

      const filePath = storageData.path;

      // Insert the bank_statements record first so we have the ID
      const { data: bsData, error: bsError } = await supabase
        .from('bank_statements')
        .insert({
          station_id: user.station_id,
          file_storage_path: filePath,
          ocr_raw_text: null,
          parsed_total: null,
        })
        .select('id')
        .single();

      if (bsError) throw bsError;
      setBankStatementId(bsData.id);

      // Now call the OCR edge function
      setUploading(false);
      setProcessing(true);
      const { data: ocrData, error: ocrError } = await supabase.functions.invoke(
        'ocr-bank-statement',
        { body: { file_path: filePath, station_id: user.station_id } }
      );

      if (ocrError) {
        // OCR failed — fall back to manual mode, don't block the user
        console.warn('OCR failed, falling back to manual mode:', ocrError);
        setOcrResult({
          success: false,
          file_path: filePath,
          ocr_text: null,
          total_candidates: [],
          confidence: 'manual',
          matches: [],
        });
      } else {
        // OCR succeeded — the edge function already inserted its own bank_statements row,
        // so we patch the one we inserted earlier with the OCR results
        await supabase
          .from('bank_statements')
          .update({
            ocr_raw_text: ocrData.ocr_text ?? null,
            parsed_total: ocrData.total_candidates?.[0] ?? null,
          })
          .eq('id', bsData.id);

        setOcrResult({
          ...ocrData,
          file_path: filePath,
        });
      }
    } catch (error: any) {
      console.error('Error uploading bank statement:', error);
      setErrorMsg(error.message || 'Failed to upload bank statement. Please try again.');
    } finally {
      setUploading(false);
      setProcessing(false);
    }
  };

  const handleConfirmTotal = async () => {
    if (!user?.station_id || !ocrResult || !bankStatementId) return;
    if (reportedTotal === '' || reportedTotal < 0) {
      setErrorMsg('Please enter a valid total amount.');
      return;
    }

    setConfirming(true);
    setErrorMsg(null);
    try {
      const confirmedTotal = Number(reportedTotal);
      const bankTotal = ocrResult.total_candidates?.[0] ?? confirmedTotal;

      // Update the bank statement record with confirmed total
      const { error: updateError } = await supabase
        .from('bank_statements')
        .update({
          parsed_total: isManualMode ? confirmedTotal : bankTotal,
          confirmed_by: user.id,
        })
        .eq('id', bankStatementId);

      if (updateError) throw updateError;

      // Task 1 — write discrepancy_flags if totals differ (only when we have both values)
      if (!isManualMode) {
        const difference = confirmedTotal - bankTotal;
        if (difference !== 0) {
          // We need at least one report_version to link against. Use the latest one for
          // this station if available; the flag can be linked to a real version later.
          const { data: latestVersion } = await supabase
            .from('report_versions')
            .select('id, reports!inner(station_id)')
            .eq('reports.station_id', user.station_id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (latestVersion?.id) {
            const { error: flagError } = await supabase
              .from('discrepancy_flags')
              .insert({
                report_version_id: latestVersion.id,
                bank_statement_id: bankStatementId,
                reported_total: confirmedTotal,
                bank_total: bankTotal,
                difference: Math.abs(difference),
                resolved: false,
              });

            if (flagError) {
              // Non-fatal — log but don't block the confirmation
              console.error('Failed to write discrepancy flag:', flagError);
            }
          }
        }
      }

      setSuccessMsg('Bank statement confirmed successfully!');
      setTimeout(() => navigate('/dashboard'), 1500);
    } catch (error: any) {
      console.error('Error confirming total:', error);
      setErrorMsg(error.message || 'Failed to confirm total. Please try again.');
    } finally {
      setConfirming(false);
    }
  };

  const isManualMode = !ocrResult?.ocr_text || ocrResult?.confidence === 'manual';
  const bankTotal: number | null =
    !isManualMode && ocrResult?.total_candidates?.length > 0
      ? ocrResult.total_candidates[0]
      : null;
  const difference =
    bankTotal !== null && reportedTotal !== ''
      ? Math.abs(Number(reportedTotal) - bankTotal)
      : null;

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

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Bank Statement Reconciliation</h1>
          <p className="text-sm text-gray-500 mt-1">
            Upload your bank statement — we'll read the totals automatically and flag any discrepancies.
          </p>
        </div>

        {/* Global error / success banners */}
        {errorMsg && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
            {errorMsg}
          </div>
        )}
        {successMsg && (
          <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-700">
            {successMsg}
          </div>
        )}

        {!ocrResult ? (
          /* ── Step 1: Upload ── */
          <div className="card p-6 space-y-6">
            <div>
              <h2 className="text-base font-semibold text-gray-900 mb-3">Upload Bank Statement</h2>
              <p className="text-sm text-gray-500 mb-4">
                Accepted formats: image (JPG, PNG) or PDF.
              </p>
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={handleFileSelect}
                className="block w-full text-sm text-gray-500
                  file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0
                  file:text-sm file:font-medium file:bg-indigo-50 file:text-indigo-700
                  hover:file:bg-indigo-100"
              />
              {file && (
                <p className="mt-2 text-sm text-gray-600">Selected: {file.name}</p>
              )}
            </div>

            <button
              onClick={handleUpload}
              disabled={!file || uploading || processing}
              className="btn btn-primary w-full"
            >
              {uploading
                ? 'Uploading...'
                : processing
                ? 'Reading statement (OCR)...'
                : 'Upload & Process'}
            </button>
          </div>
        ) : (
          /* ── Step 2: Review & Confirm ── */
          <div className="space-y-6">
            {/* OCR results or manual entry */}
            <div className="card p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-4">
                {isManualMode ? 'Enter Bank Statement Total' : 'Detected Amounts'}
              </h2>

              {isManualMode ? (
                <div className="space-y-4">
                  <p className="text-sm text-gray-500">
                    Automatic reading wasn't available for this file. Please type the closing balance
                    from the statement.
                  </p>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Bank Statement Total (₦)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={reportedTotal}
                      onChange={(e) => {
                        setReportedTotal(e.target.value === '' ? '' : Number(e.target.value));
                        setErrorMsg(null);
                      }}
                      className="input w-full"
                      placeholder="0"
                    />
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-sm text-gray-500 mb-3">
                    Select the figure that represents the closing balance:
                  </p>
                  <div className="space-y-2">
                    {ocrResult.total_candidates?.map((total: number, index: number) => (
                      <button
                        key={index}
                        onClick={() => setReportedTotal(total)}
                        className={`w-full text-left p-3 border rounded-lg transition-colors ${
                          reportedTotal === total
                            ? 'border-indigo-500 bg-indigo-50'
                            : 'border-gray-200 hover:border-gray-300 bg-white'
                        }`}
                      >
                        <span className="text-base font-medium text-gray-900">
                          ₦{total.toLocaleString()}
                        </span>
                        {index === 0 && (
                          <span className="ml-2 text-xs text-gray-400">(highest detected)</span>
                        )}
                      </button>
                    ))}
                  </div>

                  {ocrResult.matches?.length > 0 && (
                    <details className="mt-4">
                      <summary className="text-xs text-gray-400 cursor-pointer">
                        Show matched text ({ocrResult.matches.length} lines)
                      </summary>
                      <div className="mt-2 bg-gray-50 p-3 rounded-lg max-h-40 overflow-y-auto">
                        {ocrResult.matches.map((match: string, i: number) => (
                          <p key={i} className="text-xs text-gray-600 font-mono">{match}</p>
                        ))}
                      </div>
                    </details>
                  )}
                </>
              )}
            </div>

            {/* Reported total input (OCR mode only — user enters what's on the report for comparison) */}
            {!isManualMode && (
              <div className="card p-6">
                <h2 className="text-base font-semibold text-gray-900 mb-3">Your Reported Total</h2>
                <p className="text-sm text-gray-500 mb-4">
                  Enter the income total from the church report to compare against the bank statement.
                </p>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reported Total (₦)
                </label>
                <input
                  type="number"
                  min="0"
                  value={reportedTotal}
                  onChange={(e) => {
                    setReportedTotal(e.target.value === '' ? '' : Number(e.target.value));
                    setErrorMsg(null);
                  }}
                  className="input w-full"
                  placeholder="0"
                />
              </div>
            )}

            {/* Reconciliation result (OCR mode only) */}
            {!isManualMode && bankTotal !== null && reportedTotal !== '' && difference !== null && (
              <div className={`card p-6 border-2 ${
                difference === 0
                  ? 'border-green-500'
                  : difference < 100
                  ? 'border-yellow-400'
                  : 'border-red-500'
              }`}>
                <h2 className="text-base font-semibold text-gray-900 mb-4">Reconciliation Result</h2>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Your reported total</span>
                    <span className="font-medium text-gray-900">₦{Number(reportedTotal).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Bank statement total</span>
                    <span className="font-medium text-gray-900">₦{bankTotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm border-t pt-2 mt-2">
                    <span className="font-medium text-gray-900">Difference</span>
                    <span className={`font-bold ${
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

                <div className={`mt-4 p-3 rounded-lg ${
                  difference === 0
                    ? 'bg-green-50'
                    : difference < 100
                    ? 'bg-yellow-50'
                    : 'bg-red-50'
                }`}>
                  {difference === 0 ? (
                    <>
                      <p className="text-sm font-medium text-green-800">✓ Perfect match</p>
                      <p className="text-xs text-green-700 mt-0.5">Reported total matches the bank statement.</p>
                    </>
                  ) : difference < 100 ? (
                    <>
                      <p className="text-sm font-medium text-yellow-800">⚠ Minor discrepancy</p>
                      <p className="text-xs text-yellow-700 mt-0.5">
                        Small difference — please verify manually. A discrepancy record will be saved.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-red-800">✗ Significant discrepancy</p>
                      <p className="text-xs text-red-700 mt-0.5">
                        Large difference detected. A discrepancy record will be saved for review.
                      </p>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleConfirmTotal}
                disabled={reportedTotal === '' || confirming}
                className="btn btn-primary flex-1"
              >
                {confirming ? 'Saving...' : 'Confirm & Save'}
              </button>
              <button
                onClick={() => {
                  setOcrResult(null);
                  setBankStatementId(null);
                  setReportedTotal('');
                  setFile(null);
                  setErrorMsg(null);
                }}
                className="btn btn-secondary flex-1"
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
