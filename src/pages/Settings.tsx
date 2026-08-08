import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';

export default function Settings() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [processingPayment, setProcessingPayment] = useState(false);

  const handleUpgrade = async () => {
    setProcessingPayment(true);
    
    try {
      // In test mode, we'll simulate a successful payment
      // In production, this would integrate with Paystack
      const paystackPublicKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY;
      
      if (!paystackPublicKey) {
        // Test mode - simulate payment
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Update subscription status
        const { error } = await supabase
          .from('users')
          .update({
            subscription_status: 'active',
            trial_ends_at: null,
          })
          .eq('id', user?.id);

        if (error) throw error;

        alert('Subscription upgraded successfully! (Test Mode)');
        window.location.reload();
      } else {
        // Production mode - integrate with Paystack
        // This would use Paystack's inline script or popup
        alert('Paystack integration will be activated once pricing is finalized.');
      }
    } catch (error) {
      console.error('Payment error:', error);
      alert('Failed to process payment. Please try again.');
    } finally {
      setProcessingPayment(false);
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
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-sm text-gray-600 mt-1">Manage your profile and subscription</p>
        </div>

        <div className="space-y-6">
          {/* Profile Section */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Profile</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Name</label>
                <p className="mt-1 text-sm text-gray-900">{user?.full_name}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <p className="mt-1 text-sm text-gray-900">{user?.id}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Phone</label>
                <p className="mt-1 text-sm text-gray-900">{user?.phone_number || 'Not set'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Staff ID</label>
                <p className="mt-1 text-sm text-gray-900">{user?.staff_id || 'Not set'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Role</label>
                <p className="mt-1 text-sm text-gray-900 capitalize">{user?.role}</p>
              </div>
            </div>
          </div>

          {/* Subscription Section */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Subscription</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Status</label>
                <p className="mt-1 text-sm text-gray-900 capitalize">{user?.subscription_status}</p>
              </div>
              {user?.subscription_status === 'trial' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Trial Ends</label>
                  <p className="mt-1 text-sm text-gray-900">
                    {new Date(user.trial_ends_at).toLocaleDateString()}
                  </p>
                </div>
              )}
              {(user?.subscription_status === 'trial' || user?.subscription_status === 'expired') && (
                <div className="border-t pt-4">
                  <p className="text-sm text-gray-600 mb-3">
                    Upgrade to continue using all features.
                  </p>
                  <div className="bg-gray-50 p-4 rounded-md mb-4">
                    <p className="text-sm font-medium text-gray-900">Monthly Subscription</p>
                    <p className="text-xs text-gray-500">Pricing to be finalized</p>
                  </div>
                  <button
                    onClick={handleUpgrade}
                    disabled={processingPayment}
                    className="w-full px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {processingPayment ? 'Processing...' : 'Upgrade Subscription'}
                  </button>
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    Secure payment via Paystack
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Sign Out */}
          <div className="bg-white shadow rounded-lg p-6">
            <button
              onClick={signOut}
              className="w-full px-4 py-2 border border-red-300 text-red-700 rounded-md hover:bg-red-50"
            >
              Sign Out
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
