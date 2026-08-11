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
import ServiceEntryDetail from './pages/ServiceEntryDetail';
import WofbiEntry from './pages/WofbiEntry';
import DiscrepancyFlags from './pages/DiscrepancyFlags';
import { useAuth } from './hooks/useAuth';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { authUser, profile, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#080A0F' }}>
        <div style={{ width: 32, height: 32, border: '3px solid rgba(79,70,229,0.2)', borderTopColor: '#4F46E5', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  if (!authUser) return <Navigate to="/signin" replace />;
  if (!profile) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

function AuthenticatedRoute({ children }: { children: React.ReactNode }) {
  const { authUser, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#080A0F' }}>
        <div style={{ width: 32, height: 32, border: '3px solid rgba(79,70,229,0.2)', borderTopColor: '#4F46E5', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  if (!authUser) return <Navigate to="/signin" replace />;
  return <>{children}</>;
}

function ConfigError() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#080A0F', padding: '0 16px' }}>
      <div style={{ maxWidth: 480, width: '100%', background: 'rgba(18,21,28,0.85)', border: '1px solid rgba(255,255,255,0.11)', borderRadius: 16, padding: 32, backdropFilter: 'blur(24px)' }}>
        <div style={{ color: '#FCA5A5', display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <svg width="48" height="48" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h1 style={{ color: '#F5F7FA', fontSize: 20, fontWeight: 700, textAlign: 'center', marginBottom: 8 }}>Missing Supabase Configuration</h1>
        <p style={{ color: '#9CA3AF', fontSize: 14, textAlign: 'center', marginBottom: 20 }}>The application requires Supabase environment variables to run.</p>
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: 16 }}>
          <p style={{ color: '#9CA3AF', fontSize: 13, marginBottom: 8 }}>Add to your <code style={{ color: '#A5B4FC' }}>.env</code> file:</p>
          <code style={{ color: '#6B7280', fontSize: 12, display: 'block', fontFamily: 'monospace', lineHeight: 1.7 }}>
            VITE_SUPABASE_URL=your_project_url<br />
            VITE_SUPABASE_ANON_KEY=your_anon_key
          </code>
        </div>
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
          <Route path="/entry/:id" element={<ProtectedRoute><ServiceEntryDetail /></ProtectedRoute>} />
          <Route path="/wofbi" element={<ProtectedRoute><WofbiEntry /></ProtectedRoute>} />
          <Route path="/discrepancies" element={<ProtectedRoute><DiscrepancyFlags /></ProtectedRoute>} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
