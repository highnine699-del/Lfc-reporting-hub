import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

export default function Onboarding() {
  const { authUser } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [staffId, setStaffId] = useState('');
  const [pairingCode, setPairingCode] = useState('');
  const [isDelegate, setIsDelegate] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authUser) return;

    setLoading(true);
    try {
      if (isDelegate && pairingCode) {
        // Verify pairing code and link to pastor
        const { data: pairing, error: pairingError } = await supabase
          .from('delegate_pairing_codes')
          .select('*')
          .eq('code', pairingCode)
          .eq('used', false)
          .single();

        if (pairingError || !pairing) {
          throw new Error('Invalid or expired pairing code');
        }

        // Get pastor's station
        const { data: pastor } = await supabase
          .from('users')
          .select('station_id')
          .eq('id', pairing.pastor_id)
          .single();

        // Insert user as delegate
        const { error: insertError } = await supabase
          .from('users')
          .insert({
            id: authUser.id,
            full_name: fullName,
            phone_number: phoneNumber,
            staff_id: staffId || null,
            role: 'delegate',
            linked_pastor_id: pairing.pastor_id,
            station_id: pastor?.station_id,
            subscription_status: 'trial',
            trial_ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          });

        if (insertError) throw insertError;

        // Mark pairing code as used
        await supabase
          .from('delegate_pairing_codes')
          .update({ used: true })
          .eq('id', pairing.id);
      } else {
        // Create as pastor with new station
        const { data: station, error: stationError } = await supabase
          .from('stations')
          .insert({
            name: `${fullName}'s Station`,
            level: 'community',
          })
          .select()
          .single();

        if (stationError) throw stationError;

        // Insert user as pastor
        const { error: insertError } = await supabase
          .from('users')
          .insert({
            id: authUser.id,
            full_name: fullName,
            phone_number: phoneNumber,
            staff_id: staffId || null,
            role: 'pastor',
            station_id: station.id,
            subscription_status: 'trial',
            trial_ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          });

        if (insertError) throw insertError;
      }

      navigate('/dashboard');
    } catch (error: any) {
      console.error('Onboarding error:', error);
      alert(error.message || 'Failed to complete onboarding');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Complete Your Profile
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            {isDelegate ? 'Enter pairing code to link with your pastor' : 'Set up your station account'}
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Full Name</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Phone Number</label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Staff ID (Optional)</label>
              <input
                type="text"
                value={staffId}
                onChange={(e) => setStaffId(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="delegate"
                checked={isDelegate}
                onChange={(e) => setIsDelegate(e.target.checked)}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <label htmlFor="delegate" className="ml-2 block text-sm text-gray-900">
                I am a delegate joining an existing station
              </label>
            </div>

            {isDelegate && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Pairing Code</label>
                <input
                  type="text"
                  required
                  value={pairingCode}
                  onChange={(e) => setPairingCode(e.target.value)}
                  placeholder="Enter 6-digit code"
                  maxLength={6}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Complete Setup'}
          </button>
        </form>
      </div>
    </div>
  );
}
