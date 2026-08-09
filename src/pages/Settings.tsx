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
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
          <p className="text-sm text-gray-600 mt-1">Manage your profile and subscription</p>
        </div>

        <div className="space-y-6">
          {/* Profile Section */}
          <div className="card p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Profile</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <p className="text-sm text-gray-900">{user?.full_name}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <p className="text-sm text-gray-900">{user?.id}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <p className="text-sm text-gray-900">{user?.phone_number || 'Not set'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Staff ID</label>
                <p className="text-sm text-gray-900">{user?.staff_id || 'Not set'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <p className="text-sm text-gray-900 capitalize">{user?.role}</p>
              </div>
            </div>
          </div>

          {/* Subscription Section */}
          <div className="card p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Subscription</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <span className={`badge ${
                  user?.subscription_status === 'active' ? 'badge-success' : 
                  user?.subscription_status === 'trial' ? 'badge-warning' : 'badge-error'
                }`}>
                  {user?.subscription_status ? user.subscription_status.charAt(0).toUpperCase() + user.subscription_status.slice(1) : 'Unknown'}
                </span>
              </div>
              {user?.subscription_status === 'trial' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Trial Ends</label>
                  <p className="text-sm text-gray-900">
                    {new Date(user.trial_ends_at).toLocaleDateString()}
                  </p>
                </div>
              )}
              {(user?.subscription_status === 'trial' || user?.subscription_status === 'expired') && (
                <div className="border-t border-gray-200 pt-4">
                  <p className="text-sm text-gray-600 mb-3">
                    Upgrade to continue using all features.
                  </p>
                  <div className="bg-gray-50 p-4 rounded-lg mb-4">
                    <p className="text-sm font-medium text-gray-900">Monthly Subscription</p>
                    <p className="text-xs text-gray-500">Pricing to be finalized</p>
                  </div>
                  <button
                    onClick={handleUpgrade}
                    disabled={processingPayment}
                    className="btn btn-primary w-full"
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
          <div className="card p-6">
            <button
              onClick={signOut}
              className="btn btn-danger w-full"
            >
              Sign Out
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
