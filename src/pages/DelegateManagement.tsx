import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';

export default function DelegateManagement() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [pairingCode, setPairingCode] = useState('');
  const [expiresIn, setExpiresIn] = useState(10);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [codeExpiry, setCodeExpiry] = useState<Date | null>(null);

  // Task 3 — fetch real linked delegates
  const { data: delegates, isLoading: delegatesLoading } = useQuery({
    queryKey: ['delegates', user?.station_id],
    queryFn: async () => {
      if (!user?.station_id) return [];
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, staff_id, phone_number, created_at')
        .eq('station_id', user.station_id)
        .eq('role', 'delegate')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user?.station_id && user?.role === 'pastor',
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not authenticated');
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiry = new Date(Date.now() + expiresIn * 60 * 1000);

      const { error } = await supabase
        .from('delegate_pairing_codes')
        .insert({
          pastor_id: user.id,
          code,
          expires_at: expiry.toISOString(),
          used: false,
        });
      if (error) throw error;
      return { code, expiry };
    },
    onSuccess: ({ code, expiry }) => {
      setPairingCode(code);
      setCodeExpiry(expiry);
      setErrorMsg(null);
    },
    onError: (error: any) => {
      setErrorMsg(error.message || 'Failed to generate pairing code. Please try again.');
    },
  });

  const unlinkMutation = useMutation({
    mutationFn: async (delegateId: string) => {
      // Unlink by clearing linked_pastor_id; we don't delete the account
      const { error } = await supabase
        .from('users')
        .update({ linked_pastor_id: null, station_id: user!.station_id })
        .eq('id', delegateId)
        .eq('linked_pastor_id', user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delegates', user?.station_id] });
    },
    onError: (error: any) => {
      setErrorMsg(error.message || 'Failed to unlink delegate.');
    },
  });

  // Task 23 — role guard AFTER all hooks (no early return before hooks)
  if (!user) return null; // still loading

  if (user.role !== 'pastor') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-gray-900 mb-3">Access Denied</h1>
          <p className="text-gray-500 mb-4">This page is only accessible to pastors.</p>
          <button onClick={() => navigate('/dashboard')} className="btn btn-primary">
            Back to Dashboard
          </button>
        </div>
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

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Delegate Management</h1>
          <p className="text-sm text-gray-500 mt-1">
            Generate pairing codes to link delegate accounts to your station.
          </p>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
            {errorMsg}
          </div>
        )}

        {/* Generate Pairing Code */}
        <div className="card p-6 mb-6">
          <h2 className="text-base font-semibold text-gray-900 mb-1">Generate Pairing Code</h2>
          <p className="text-sm text-gray-500 mb-4">
            Share this code with your delegate so they can link their account during sign-up.
          </p>

          <div className="flex items-center gap-3 mb-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Expires in</label>
              <select
                value={expiresIn}
                onChange={(e) => setExpiresIn(Number(e.target.value))}
                className="input text-sm"
              >
                <option value={5}>5 minutes</option>
                <option value={10}>10 minutes</option>
                <option value={15}>15 minutes</option>
              </select>
            </div>
            <div className="pt-5">
              <button
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending}
                className="btn btn-primary"
              >
                {generateMutation.isPending ? 'Generating...' : 'Generate Code'}
              </button>
            </div>
          </div>

          {pairingCode && codeExpiry && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
              <p className="text-xs text-gray-500 mb-1">Pairing code — share this with your delegate:</p>
              <p className="text-4xl font-mono font-bold text-indigo-900 tracking-widest">
                {pairingCode}
              </p>
              <p className="text-xs text-gray-500 mt-2">
                Expires at {codeExpiry.toLocaleTimeString()} ({expiresIn} minutes)
              </p>
            </div>
          )}
        </div>

        {/* Linked Delegates */}
        <div className="card p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">
            Linked Delegates
            {delegates && delegates.length > 0 && (
              <span className="ml-2 text-sm font-normal text-gray-400">
                ({delegates.length})
              </span>
            )}
          </h2>

          {delegatesLoading ? (
            <p className="text-sm text-gray-400">Loading delegates...</p>
          ) : delegates && delegates.length > 0 ? (
            <div className="space-y-3">
              {delegates.map((delegate: any) => (
                <div
                  key={delegate.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">{delegate.full_name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {delegate.staff_id ? `Staff ID: ${delegate.staff_id}` : 'No staff ID'}
                      {delegate.phone_number ? ` · ${delegate.phone_number}` : ''}
                    </p>
                    <p className="text-xs text-gray-400">
                      Linked {new Date(delegate.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={() => unlinkMutation.mutate(delegate.id)}
                    disabled={unlinkMutation.isPending}
                    className="btn btn-ghost text-xs text-red-500 hover:text-red-700"
                  >
                    Unlink
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-sm text-gray-400">No delegates linked yet.</p>
              <p className="text-xs text-gray-400 mt-1">
                Generate a pairing code above and share it with your delegate.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
