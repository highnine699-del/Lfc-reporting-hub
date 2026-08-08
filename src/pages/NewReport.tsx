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
        <header className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <button
              onClick={handleCancel}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              ← Back
            </button>
          </div>
        </header>

        <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">
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
        <header className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <button
              onClick={handleCancel}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              ← Back
            </button>
          </div>
        </header>

        <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">
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

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-8">Create New Report</h1>

        <div className="bg-white shadow rounded-lg p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Report Period</label>
            <select
              value={periodType}
              onChange={(e) => setPeriodType(e.target.value as any)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="half_year">Half-Yearly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-4">Data Entry Method</label>
            <div className="grid grid-cols-2 gap-4">
              {[
                { id: 'manual', label: 'Manual Entry', icon: '📝' },
                { id: 'whatsapp', label: 'Paste WhatsApp Text', icon: '💬' },
                { id: 'voice', label: 'Voice Input', icon: '🎤' },
                { id: 'bank', label: 'Upload Bank Statement', icon: '📄' },
              ].map((method) => (
                <button
                  key={method.id}
                  onClick={() => setInputMethod(method.id as any)}
                  className={`p-4 border-2 rounded-lg text-left transition-colors ${
                    inputMethod === method.id
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="text-2xl mb-2">{method.icon}</div>
                  <div className="text-sm font-medium text-gray-900">{method.label}</div>
                </button>
              ))}
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
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          )}

          {inputMethod === 'voice' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Voice Input</label>
              <div className="space-y-4">
                <div className="flex gap-2">
                  {!isRecording ? (
                    <button
                      onClick={startRecording}
                      className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                    >
                      Start Recording
                    </button>
                  ) : (
                    <button
                      onClick={stopRecording}
                      className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
                    >
                      Stop Recording
                    </button>
                  )}
                  {isRecording && (
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                      <span className="text-sm text-red-600">Recording...</span>
                    </div>
                  )}
                </div>
                <textarea
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  rows={8}
                  placeholder="Your voice transcript will appear here..."
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>
          )}

          <button
            onClick={handleContinue}
            disabled={!startDate || !endDate || (inputMethod === 'whatsapp' && !whatsappText) || (inputMethod === 'voice' && !transcript) || parsing}
            className="w-full px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {parsing ? 'Parsing...' : 'Continue'}
          </button>
        </div>
      </main>
    </div>
  );
}
