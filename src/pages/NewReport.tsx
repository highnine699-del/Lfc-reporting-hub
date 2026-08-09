import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import ManualReportForm from '../components/ManualReportForm';
import ParsePreview from '../components/ParsePreview';

export default function NewReport() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [periodType, setPeriodType] = useState<'weekly' | 'monthly' | 'quarterly' | 'half_year' | 'yearly'>('monthly');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [inputMethod, setInputMethod] = useState<'manual' | 'whatsapp' | 'voice' | 'bank'>('manual');
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [whatsappText, setWhatsappText] = useState('');
  const [parsedData, setParsedData] = useState<Record<string, any> | null>(null);
  const [parsing, setParsing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [recognition, setRecognition] = useState<any>(null);

  const handleContinue = async () => {
    if (inputMethod === 'manual') {
      setShowForm(true);
    } else if (inputMethod === 'whatsapp') {
      setParsing(true);
      try {
        const { data, error } = await supabase.functions.invoke('parse-whatsapp-text', {
          body: { text: whatsappText },
        });
        if (error) throw error;
        setParsedData(data.data);
      } catch (error) {
        console.error('Error parsing text:', error);
        alert('Failed to parse text. Please try again.');
      } finally {
        setParsing(false);
      }
    } else if (inputMethod === 'voice') {
      if (transcript) {
        setParsing(true);
        try {
          const { data, error } = await supabase.functions.invoke('parse-whatsapp-text', {
            body: { text: transcript },
          });
          if (error) throw error;
          setParsedData(data.data);
        } catch (error) {
          console.error('Error parsing voice transcript:', error);
          alert('Failed to parse voice transcript. Please try again.');
        } finally {
          setParsing(false);
        }
      }
    } else if (inputMethod === 'bank') {
      navigate('/bank-reconciliation');
    }
  };

  const startRecording = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Speech recognition is not supported in your browser. Please use Chrome or Edge.');
      return;
    }

    // Stop any existing recognition first
    if (recognition) {
      try {
        recognition.stop();
      } catch (e) {
        // Ignore if already stopped
      }
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognitionInstance = new SpeechRecognition();
    
    recognitionInstance.continuous = true;
    recognitionInstance.interimResults = true;
    recognitionInstance.lang = 'en-US';

    recognitionInstance.onstart = () => {
      setIsRecording(true);
    };

    recognitionInstance.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' ';
        } else {
          interimTranscript += transcript;
        }
      }

      setTranscript(finalTranscript + interimTranscript);
    };

    recognitionInstance.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      // Don't set isRecording to false for "aborted" errors (normal when stopping)
      if (event.error !== 'aborted') {
        setIsRecording(false);
        alert('Speech recognition error: ' + event.error);
      }
    };

    recognitionInstance.onend = () => {
      setIsRecording(false);
    };

    setRecognition(recognitionInstance);
    
    // Small delay to ensure the instance is set before starting
    setTimeout(() => {
      try {
        recognitionInstance.start();
      } catch (e) {
        console.error('Failed to start recognition:', e);
        setIsRecording(false);
      }
    }, 100);
  };

  const stopRecording = () => {
    if (recognition) {
      try {
        recognition.stop();
      } catch (e) {
        // Ignore if already stopped
        console.error('Error stopping recognition:', e);
      }
    }
    setIsRecording(false);
  };

  const handleFormSubmit = async (data: Record<string, any>) => {
    if (!user?.station_id) return;
    setLoading(true);

    try {
      const { data: template, error: templateError } = await supabase
        .from('templates')
        .select('*')
        .eq('period_type', periodType)
        .single();

      let templateId = template?.id;

      if (templateError || !template) {
        // Create template if it doesn't exist or query failed
        const { data: newTemplate, error: createError } = await supabase
          .from('templates')
          .insert({
            name: `${periodType.charAt(0).toUpperCase() + periodType.slice(1)} Report`,
            period_type: periodType,
          })
          .select()
          .single();

        if (createError) {
          console.error('Error creating template:', createError);
          // Continue with null template_id as fallback
        } else {
          templateId = newTemplate.id;
        }
      }

      const { data: report, error: reportError } = await supabase
        .from('reports')
        .insert({
          station_id: user.station_id,
          template_id: templateId,
          period_type: periodType,
          period_start: startDate,
          period_end: endDate,
        })
        .select()
        .single();

      if (reportError) throw reportError;

      const { error: versionError } = await supabase
        .from('report_versions')
        .insert({
          report_id: report.id,
          template_version_id: template?.current_version_id || null,
          data: data,
          edited_by: user.id,
          source: inputMethod === 'whatsapp' ? 'whatsapp_text' : inputMethod === 'voice' ? 'voice' : 'manual',
        });

      if (versionError) throw versionError;

      navigate(`/report/${report.id}`);
    } catch (error: any) {
      console.error('Error saving report:', error);
      alert('Failed to save report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setParsedData(null);
    setWhatsappText('');
    setTranscript('');
  };

  if (showForm) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <button
              onClick={handleCancel}
              className="btn btn-ghost text-sm"
            >
              ← Back
            </button>
          </div>
        </header>

        <main className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-gray-900">
              {periodType.charAt(0).toUpperCase() + periodType.slice(1)} Report
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              {startDate} - {endDate}
            </p>
          </div>
          {loading ? (
            <div className="text-center py-8">
              <div className="text-gray-500">Saving report...</div>
            </div>
          ) : (
            <ManualReportForm
              periodType={periodType}
              startDate={startDate}
              endDate={endDate}
              onSubmit={handleFormSubmit}
              onCancel={handleCancel}
            />
          )}
        </main>
      </div>
    );
  }

  if (parsedData) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <button
              onClick={handleCancel}
              className="btn btn-ghost text-sm"
            >
              ← Back
            </button>
          </div>
        </header>

        <main className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-gray-900">
              {periodType.charAt(0).toUpperCase() + periodType.slice(1)} Report
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              {startDate} - {endDate}
            </p>
          </div>
          {loading ? (
            <div className="text-center py-8">
              <div className="text-gray-500">Saving report...</div>
            </div>
          ) : (
            <ParsePreview
              originalInput={inputMethod === 'voice' ? transcript : whatsappText}
              extractedData={parsedData}
              onConfirm={handleFormSubmit}
              onCancel={handleCancel}
              source={inputMethod === 'voice' ? 'voice' : 'whatsapp'}
            />
          )}
        </main>
      </div>
    );
  }

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
        <h1 className="text-2xl font-semibold text-gray-900 mb-8">Create New Report</h1>

        <div className="card p-6 space-y-8">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Report Period</label>
            <select
              value={periodType}
              onChange={(e) => setPeriodType(e.target.value as any)}
              className="input"
            >
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="half_year">Half-Yearly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="input"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-4">Data Entry Method</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                onClick={() => setInputMethod('manual')}
                className={`card p-6 text-left transition-colors ${
                  inputMethod === 'manual'
                    ? 'border-indigo-500 ring-2 ring-indigo-500'
                    : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414 1.414-1.414L12 0l4 4m0 0l4-4" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-900">Manual Entry</h3>
                    <p className="text-sm text-gray-500 mt-1">Enter figures manually</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setInputMethod('whatsapp')}
                className={`card p-6 text-left transition-colors ${
                  inputMethod === 'whatsapp'
                    ? 'border-indigo-500 ring-2 ring-indigo-500'
                    : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h4.01M16 12h4M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-900">WhatsApp Text</h3>
                    <p className="text-sm text-gray-500 mt-1">Paste message</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setInputMethod('voice')}
                className={`card p-6 text-left transition-colors ${
                  inputMethod === 'voice'
                    ? 'border-indigo-500 ring-2 ring-indigo-500'
                    : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v10m-7-7v-10m14 0v10" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-900">Voice Input</h3>
                    <p className="text-sm text-gray-500 mt-1">Speak to enter</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setInputMethod('bank')}
                className={`card p-6 text-left transition-colors ${
                  inputMethod === 'bank'
                    ? 'border-indigo-500 ring-2 ring-indigo-500'
                    : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-900">Bank Statement</h3>
                    <p className="text-sm text-gray-500 mt-1">Upload and reconcile</p>
                  </div>
                </div>
              </button>
            </div>
          </div>

          {inputMethod === 'whatsapp' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Paste WhatsApp Report Text</label>
              <textarea
                value={whatsappText}
                onChange={(e) => setWhatsappText(e.target.value)}
                rows={8}
                placeholder="Paste your WhatsApp-style report text here..."
                className="input"
              />
            </div>
          )}

          {inputMethod === 'voice' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Voice Input</label>
              <div className="space-y-4">
                <div className="flex gap-3">
                  {!isRecording ? (
                    <button
                      onClick={startRecording}
                      className="btn btn-danger"
                    >
                      Start Recording
                    </button>
                  ) : (
                    <button
                      onClick={stopRecording}
                      className="btn btn-secondary"
                    >
                      Stop Recording
                    </button>
                  )}
                  {isRecording && (
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                      <span className="text-sm text-red-600 font-medium">Recording...</span>
                    </div>
                  )}
                </div>
                <textarea
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  rows={8}
                  placeholder="Your voice transcript will appear here..."
                  className="input"
                />
              </div>
            </div>
          )}

          <button
            onClick={handleContinue}
            disabled={!startDate || !endDate || (inputMethod === 'whatsapp' && !whatsappText) || (inputMethod === 'voice' && !transcript) || parsing}
            className="btn btn-primary w-full text-base"
          >
            {parsing ? 'Parsing...' : 'Continue'}
          </button>
        </div>
      </main>
    </div>
  );
}
