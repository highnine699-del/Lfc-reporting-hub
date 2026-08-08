import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';

export default function DelegateManagement() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Check if user is pastor
  if (user?.role !== 'pastor') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600 mb-4">This page is only accessible to pastors.</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const [pairingCode, setPairingCode] = useState('');
  const [expiresIn, setExpiresIn] = useState(10);
  const [loading, setLoading] = useState(false);

  const generatePairingCode = async () => {
    if (!user) return;
    setLoading(true);
    
    try {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + expiresIn * 60 * 1000).toISOString();

      const { error } = await supabase
        .from('delegate_pairing_codes')
        .insert({
          pastor_id: user.id,
          code,
          expires_at: expiresAt,
          used: false,
        });

      if (error) throw error;
      setPairingCode(code);
    } catch (error: any) {
      console.error('Error generating pairing code:', error);
      alert('Failed to generate pairing code');
    } finally {
      setLoading(false);
    }
  };

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
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Delegate Management</h1>
          <p className="text-sm text-gray-600 mt-1">Generate pairing codes to link delegate accounts to your station</p>
        </div>

        <div className="bg-white shadow rounded-lg p-6 space-y-6">
          <div>
            <h2 className="text-lg font-medium text-gray-900 mb-4">Generate Pairing Code</h2>
            <p className="text-sm text-gray-600 mb-4">
              Share this code with your delegate to link their account to your station.
            </p>
            
            <div className="flex items-center space-x-4 mb-4">
              <select
                value={expiresIn}
                onChange={(e) => setExpiresIn(Number(e.target.value))}
                className="px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value={5}>5 minutes</option>
                <option value={10}>10 minutes</option>
                <option value={15}>15 minutes</option>
              </select>
              <button
                onClick={generatePairingCode}
                disabled={loading}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
              >
                {loading ? 'Generating...' : 'Generate Code'}
              </button>
            </div>

            {pairingCode && (
              <div className="bg-indigo-50 border border-indigo-200 rounded-md p-4">
                <p className="text-sm text-gray-600 mb-2">Your pairing code:</p>
                <p className="text-3xl font-mono font-bold text-indigo-900 tracking-wider">{pairingCode}</p>
                <p className="text-xs text-gray-500 mt-2">This code expires in {expiresIn} minutes</p>
              </div>
            )}
          </div>

          <div className="border-t border-gray-200 pt-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Linked Delegates</h2>
            <p className="text-sm text-gray-500">No delegates linked yet.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
