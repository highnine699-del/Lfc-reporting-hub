import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { queryClient } from './lib/queryClient';
import { isSupabaseConfigured } from './lib/supabase';
import Auth from './pages/Auth';
import Onboarding from './pages/Onboarding';
import Dashboard from './pages/Dashboard';
import NewReport from './pages/NewReport';
import ReportDetail from './pages/ReportDetail';
import DelegateManagement from './pages/DelegateManagement';
import Settings from './pages/Settings';
import AdminTemplateMapping from './pages/AdminTemplateMapping';
import AllReports from './pages/AllReports';
import StationReports from './pages/StationReports';
import BankReconciliation from './pages/BankReconciliation';
import GenerateReport from './pages/GenerateReport';
import { useAuth } from './hooks/useAuth';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { authUser, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!authUser) {
    // Genuinely not signed in at all
    return <Navigate to="/signin" replace />;
  }

  if (!profile) {
    // Signed in, but onboarding hasn't happened yet
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}

function AuthenticatedRoute({ children }: { children: React.ReactNode }) {
  const { authUser, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!authUser) {
    return <Navigate to="/signin" replace />;
  }

  return <>{children}</>;
}

function ConfigError() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white border border-gray-200 rounded-xl shadow-md p-6">
        <div className="text-red-600 mb-4 flex justify-center">
          <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-gray-900 mb-2 text-center">Missing Supabase Configuration</h1>
        <p className="text-gray-600 text-center mb-4">
          The application requires Supabase environment variables to run.
        </p>
        <div className="bg-gray-100 p-4 rounded-lg">
          <p className="text-sm text-gray-700 mb-2">Please add these variables to your <code className="bg-gray-200 px-1 rounded">.env</code> file:</p>
          <code className="text-xs text-gray-600 block bg-gray-50 p-3 rounded border border-gray-200">
            VITE_SUPABASE_URL=your_supabase_project_url<br />
            VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
          </code>
        </div>
        <p className="text-sm text-gray-500 text-center mt-4">
          Get these values from your Supabase project dashboard under Settings → API
        </p>
      </div>
    </div>
  );
}

function App() {
  if (!isSupabaseConfigured) {
    return <ConfigError />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/signin" element={<Auth />} />
          <Route path="/signup" element={<Auth />} />
          <Route path="/onboarding" element={<AuthenticatedRoute><Onboarding /></AuthenticatedRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/report/new" element={<ProtectedRoute><NewReport /></ProtectedRoute>} />
          <Route path="/report/:id" element={<ProtectedRoute><ReportDetail /></ProtectedRoute>} />
          <Route path="/delegates" element={<ProtectedRoute><DelegateManagement /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute><AllReports /></ProtectedRoute>} />
          <Route path="/station-reports" element={<ProtectedRoute><StationReports /></ProtectedRoute>} />
          <Route path="/bank-reconciliation" element={<ProtectedRoute><BankReconciliation /></ProtectedRoute>} />
          <Route path="/admin/templates" element={<ProtectedRoute><AdminTemplateMapping /></ProtectedRoute>} />
          <Route path="/generate-report" element={<ProtectedRoute><GenerateReport /></ProtectedRoute>} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
