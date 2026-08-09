import { useState } from 'react';
import { supabase } from '../lib/supabase';

interface SignUpPanelProps {
  onSignIn: () => void;
}

export default function SignUpPanel({ onSignIn }: SignUpPanelProps) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [showEmailForm, setShowEmailForm] = useState(false);

  const handleGoogleSignUp = async () => {
    setLoading(true);
    setMessage('');
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/onboarding`,
        },
      });
      if (error) throw error;
      // OAuth redirects away — loading stays true
    } catch (error: any) {
      setMessage(error.message || 'An error occurred. Please try again.');
      setLoading(false);
    }
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setMessage('');
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/onboarding`,
        },
      });
      if (error) throw error;
      setMessage('success');
    } catch (error: any) {
      setMessage(error.message || 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const cardStyle: React.CSSProperties = {
    background: 'rgba(18, 21, 28, 0.72)',
    border: '1px solid rgba(255, 255, 255, 0.10)',
    backdropFilter: 'blur(24px) saturate(120%)',
    WebkitBackdropFilter: 'blur(24px) saturate(120%)',
    boxShadow: '0 24px 80px rgba(0, 0, 0, 0.42)',
    borderRadius: '24px',
    padding: '32px 36px 24px',
    boxSizing: 'border-box',
  };

  // Success state — email sent
  if (message === 'success') {
    return (
      <div className="auth-card rounded-3xl relative" style={cardStyle}>
        <div
          className="absolute top-0 left-4 right-4 h-px rounded-t-3xl pointer-events-none"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)' }}
        />
        <div className="text-center">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
            style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)' }}
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#4ADE80' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-xl font-bold mb-2" style={{ color: '#F5F7FA' }}>Check your email</h3>
          <p className="text-sm mb-2" style={{ color: '#6B7280' }}>We sent a sign-up link to</p>
          <p className="text-base font-semibold mb-6" style={{ color: '#F5F7FA' }}>{email}</p>
          <button
            onClick={() => { setMessage(''); setEmail(''); }}
            className="text-sm font-semibold"
            style={{ color: '#4F46E5' }}
          >
            Use another email
          </button>
        </div>
        <div className="mt-4 text-center">
          <button onClick={onSignIn} className="text-sm font-medium" style={{ color: '#6B7280' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#F5F7FA'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#6B7280'; }}
          >
            Back to sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-card rounded-3xl relative" style={cardStyle}>
      {/* Subtle highlight */}
      <div
        className="absolute top-0 left-4 right-4 h-px rounded-t-3xl pointer-events-none"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)' }}
      />

      {/* Branding */}
      <div className="text-center mb-2">
        <h1 className="font-bold tracking-wider" style={{ color: '#F5F7FA', letterSpacing: '0.14em', fontWeight: 700, fontSize: '30px', lineHeight: '1' }}>
          LFC
        </h1>
        <h2 className="font-medium tracking-wide mt-1" style={{ color: '#6B7280', letterSpacing: '0.16em', fontWeight: 500, fontSize: '13px' }}>
          REPORTING HUB
        </h2>
      </div>

      {/* Heading */}
      <div className="mb-5">
        <h3 className="font-bold mb-2" style={{ color: '#F5F7FA', letterSpacing: '-0.025em', fontWeight: 700, fontSize: '30px', lineHeight: '1.1' }}>
          Create account
        </h3>
        <p className="text-sm" style={{ color: '#6B7280', fontWeight: 400 }}>
          Set up your station reporting workspace
        </p>
      </div>

      <div className="space-y-3" style={{ minWidth: '0' }}>
        {/* Google signup — real OAuth */}
        {!showEmailForm && (
          <>
            <button
              onClick={handleGoogleSignUp}
              disabled={loading}
              className="flex items-center justify-center gap-3 transition-all duration-200 outline-none font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                height: '52px', borderRadius: '12px',
                background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.11)',
                color: '#F5F7FA', fontSize: '15px', fontWeight: 500, width: '100%', boxSizing: 'border-box',
              }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.025)'; }}
              onFocus={e => { e.currentTarget.style.boxShadow = '0 0 0 3px rgba(79,70,229,0.25)'; }}
              onBlur={e => { e.currentTarget.style.boxShadow = 'none'; }}
            >
              <svg className="flex-shrink-0" width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              {loading ? 'Redirecting...' : 'Continue with Google'}
            </button>

            {/* Separator */}
            <div className="flex items-center gap-3 my-1" style={{ width: '100%' }}>
              <div style={{ height: '1px', background: 'rgba(255,255,255,0.09)', flex: 1 }} />
              <span className="text-xs" style={{ color: 'rgba(148,163,184,0.85)', flexShrink: 0 }}>or</span>
              <div style={{ height: '1px', background: 'rgba(255,255,255,0.09)', flex: 1 }} />
            </div>

            {/* Email signup button — toggles email form */}
            <button
              onClick={() => setShowEmailForm(true)}
              className="transition-all duration-200 outline-none font-semibold"
              style={{
                height: '52px', borderRadius: '12px', background: '#4F46E5',
                border: 'none', color: '#FFFFFF', fontSize: '15px', fontWeight: 600,
                width: '100%', boxSizing: 'border-box',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#4338CA'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#4F46E5'; }}
              onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.98)'; }}
              onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
              onFocus={e => { e.currentTarget.style.boxShadow = '0 0 0 3px rgba(79,70,229,0.25)'; }}
              onBlur={e => { e.currentTarget.style.boxShadow = 'none'; }}
            >
              Sign up with email
            </button>
          </>
        )}

        {/* Email OTP form — shown after "Sign up with email" */}
        {showEmailForm && (
          <form onSubmit={handleEmailSignUp} className="space-y-3" style={{ minWidth: '0' }}>
            <div>
              <label htmlFor="signup-email" className="block text-sm font-semibold mb-2" style={{ color: '#9CA3AF' }}>
                Email address
              </label>
              <input
                id="signup-email"
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="transition-all duration-200 outline-none"
                style={{
                  height: '52px', borderRadius: '12px',
                  background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.11)',
                  padding: '0 14px', color: '#F5F7FA', fontSize: '15px',
                  width: '100%', boxSizing: 'border-box',
                }}
                onFocus={e => {
                  e.target.style.borderColor = 'rgba(79,70,229,0.35)';
                  e.target.style.boxShadow = '0 0 0 3px rgba(79,70,229,0.06)';
                }}
                onBlur={e => {
                  e.target.style.borderColor = 'rgba(255,255,255,0.11)';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="transition-all duration-200 outline-none disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
              style={{
                height: '52px', borderRadius: '12px', background: '#4F46E5',
                border: 'none', color: '#FFFFFF', fontSize: '15px', fontWeight: 600,
                width: '100%', boxSizing: 'border-box',
              }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.background = '#4338CA'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#4F46E5'; }}
            >
              {loading ? 'Sending...' : 'Send Sign-up Link'}
            </button>
            <button
              type="button"
              onClick={() => { setShowEmailForm(false); setMessage(''); }}
              className="text-sm w-full text-center"
              style={{ color: '#6B7280' }}
              onMouseEnter={e => { e.currentTarget.style.color = '#F5F7FA'; }}
              onMouseLeave={e => { e.currentTarget.style.color = '#6B7280'; }}
            >
              ← Back
            </button>
          </form>
        )}
      </div>

      {/* Error message */}
      {message && message !== 'success' && (
        <div
          className="mt-3 p-4 rounded-xl text-sm"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', color: '#FCA5A5' }}
        >
          {message}
        </div>
      )}

      {/* Footer text */}
      <div className="mt-4 pt-3 text-center">
        <p className="text-xs" style={{ color: '#6B7280', lineHeight: '1.5' }}>
          Create your station reporting workspace in minutes.
        </p>
      </div>

      {/* Back to sign in */}
      <div className="mt-4 text-center">
        <button
          onClick={onSignIn}
          className="text-sm font-medium transition-colors outline-none"
          style={{ color: '#6B7280', fontWeight: 500 }}
          onMouseEnter={e => { e.currentTarget.style.color = '#F5F7FA'; }}
          onMouseLeave={e => { e.currentTarget.style.color = '#6B7280'; }}
          onFocus={e => { e.currentTarget.style.textDecoration = 'underline'; }}
          onBlur={e => { e.currentTarget.style.textDecoration = 'none'; }}
        >
          Back to sign in
        </button>
      </div>
    </div>
  );
}
