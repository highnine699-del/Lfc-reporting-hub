import { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
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

      setMessage('Check your email for the magic link!');
    } catch (error: any) {
      setMessage(error.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/onboarding`,
        },
      });

      if (error) throw error;
    } catch (error: any) {
      setMessage(error.message || 'An error occurred');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden" style={{ backgroundColor: '#080A0F', fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif' }}>
      {/* Ambient lighting effects */}
      <div 
        className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(99, 102, 241, 0.05) 0%, transparent 70%)',
          filter: 'blur(120px)',
        }}
      />
      <div 
        className="absolute bottom-0 left-0 w-[350px] h-[350px] rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(99, 102, 241, 0.025) 0%, transparent 70%)',
          filter: 'blur(100px)',
        }}
      />

      {/* Main authentication panel */}
      <div 
        className="relative w-full px-4"
        style={{
          maxWidth: '440px',
          minWidth: '0',
          animation: 'fadeInUp 400ms ease-out',
        }}
      >
        <div 
          className="auth-card rounded-3xl relative"
          style={{
            background: 'rgba(18, 21, 28, 0.72)',
            border: '1px solid rgba(255, 255, 255, 0.10)',
            backdropFilter: 'blur(24px) saturate(120%)',
            WebkitBackdropFilter: 'blur(24px) saturate(120%)',
            boxShadow: '0 24px 80px rgba(0, 0, 0, 0.42)',
            borderRadius: '24px',
            padding: '36px',
            boxSizing: 'border-box',
          }}
        >
          <style>{`
            @media (max-width: 640px) {
              .auth-card {
                padding: 28px 24px 24px !important;
              }
            }
          `}</style>
          {/* Subtle internal highlight */}
          <div 
            className="absolute top-0 left-4 right-4 h-px rounded-t-3xl pointer-events-none"
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.06), transparent)',
            }}
          />

          {/* Branding */}
          <div className="text-center mb-6">
            <div>
              <h1 
                className="font-bold tracking-wider"
                style={{ 
                  color: '#F5F7FA', 
                  letterSpacing: '0.16em',
                  fontWeight: 700,
                  fontSize: '30px',
                  lineHeight: '1',
                }}
              >
                LFC
              </h1>
              <h2 
                className="font-medium tracking-widest mt-2"
                style={{ 
                  color: '#6B7280', 
                  letterSpacing: '0.22em',
                  fontWeight: 500,
                  fontSize: '14px',
                }}
              >
                REPORTING HUB
              </h2>
            </div>
          </div>

          {/* Welcome heading */}
          <div className="mb-6">
            <h3 
              className="font-bold mb-2"
              style={{ 
                color: '#F5F7FA', 
                letterSpacing: '-0.025em',
                fontWeight: 700,
                fontSize: '29px',
                lineHeight: '1.1',
              }}
            >
              Welcome back
            </h3>
            <p 
              className="text-sm"
              style={{ color: '#6B7280', fontWeight: 400 }}
            >
              Sign in to your station workspace
            </p>
          </div>

          {!message || message.includes('error') || message.includes('Error') ? (
            <>
              <form className="space-y-4" onSubmit={handleMagicLink} style={{ minWidth: '0' }}>
                {/* Email input */}
                <div style={{ minWidth: '0' }}>
                  <label 
                    htmlFor="email" 
                    className="block text-sm font-semibold mb-2"
                    style={{ color: '#9CA3AF', fontWeight: 600 }}
                  >
                    Email address
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="transition-all duration-200 outline-none"
                    style={{
                      height: '52px',
                      borderRadius: '12px',
                      background: 'rgba(255, 255, 255, 0.035)',
                      border: '1px solid rgba(255, 255, 255, 0.11)',
                      padding: '0 14px',
                      color: '#F5F7FA',
                      fontSize: '15px',
                      fontWeight: 400,
                      width: '100%',
                      maxWidth: '100%',
                      boxSizing: 'border-box',
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = 'rgba(79, 70, 229, 0.35)';
                      e.target.style.background = 'rgba(255, 255, 255, 0.04)';
                      e.target.style.boxShadow = '0 0 0 3px rgba(79, 70, 229, 0.06)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = 'rgba(255, 255, 255, 0.11)';
                      e.target.style.background = 'rgba(255, 255, 255, 0.035)';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                </div>

                {/* Primary CTA */}
                <button
                  type="submit"
                  disabled={loading}
                  className="transition-all duration-200 outline-none disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                  style={{
                    height: '52px',
                    borderRadius: '12px',
                    background: '#4338CA',
                    border: 'none',
                    color: '#FFFFFF',
                    fontSize: '15px',
                    fontWeight: 600,
                    width: '100%',
                    maxWidth: '100%',
                    boxSizing: 'border-box',
                  }}
                  onMouseEnter={(e) => {
                    if (!loading) {
                      e.currentTarget.style.background = '#3730A3';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#4338CA';
                  }}
                  onMouseDown={(e) => {
                    e.currentTarget.style.transform = 'scale(0.98)';
                  }}
                  onMouseUp={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(67, 56, 202, 0.2)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  {loading ? 'Sending...' : 'Send Magic Link'}
                </button>

                {/* Separator */}
                <div className="relative my-5">
                  <div className="absolute inset-0 flex items-center">
                    <div 
                      className="w-full"
                      style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}
                    />
                  </div>
                  <div className="relative flex justify-center">
                    <span 
                      className="px-4 text-xs"
                      style={{ color: '#6B7280', background: 'rgba(18, 21, 28, 0.72)' }}
                    >
                      or
                    </span>
                  </div>
                </div>

                {/* Google auth */}
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                  className="flex items-center justify-center gap-3 transition-all duration-200 outline-none disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  style={{
                    height: '52px',
                    borderRadius: '12px',
                    background: 'rgba(255, 255, 255, 0.025)',
                    border: '1px solid rgba(255, 255, 255, 0.11)',
                    color: '#F5F7FA',
                    fontSize: '15px',
                    fontWeight: 500,
                    width: '100%',
                    maxWidth: '100%',
                    boxSizing: 'border-box',
                  }}
                  onMouseEnter={(e) => {
                    if (!loading) {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.025)';
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(67, 56, 202, 0.2)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <svg 
                    className="flex-shrink-0" 
                    width="18" 
                    height="18" 
                    viewBox="0 0 24 24"
                  >
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Continue with Google
                </button>
              </form>

              {/* Error message */}
              {message && (message.includes('error') || message.includes('Error')) && (
                <div 
                  className="mt-5 p-4 rounded-xl text-sm"
                  style={{
                    background: 'rgba(239, 68, 68, 0.08)',
                    border: '1px solid rgba(239, 68, 68, 0.15)',
                    color: '#FCA5A5',
                  }}
                >
                  {message}
                </div>
              )}
            </>
          ) : (
            /* Success state */
            <div className="text-center">
              <div 
                className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
                style={{
                  background: 'rgba(34, 197, 94, 0.12)',
                  border: '1px solid rgba(34, 197, 94, 0.25)',
                }}
              >
                <svg 
                  className="w-8 h-8" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                  style={{ color: '#4ADE80' }}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 
                className="text-xl font-bold mb-2"
                style={{ color: '#F5F7FA', fontWeight: 700 }}
              >
                Check your email
              </h3>
              <p 
                className="text-sm mb-6"
                style={{ color: '#6B7280', fontWeight: 400 }}
              >
                We sent a secure sign-in link to
              </p>
              <p 
                className="text-base font-semibold mb-6"
                style={{ color: '#F5F7FA', fontWeight: 600 }}
              >
                {email}
              </p>
              <button
                onClick={() => {
                  setMessage('');
                  setEmail('');
                }}
                className="text-sm font-semibold transition-colors outline-none"
                style={{ color: '#4338CA', fontWeight: 600 }}
                onFocus={(e) => {
                  e.currentTarget.style.textDecoration = 'underline';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.textDecoration = 'none';
                }}
              >
                Use another email
              </button>
            </div>
          )}

          {/* Security text */}
          <div className="mt-6 pt-5 text-center">
            <p 
              className="text-xs"
              style={{ color: '#6B7280', fontWeight: 400 }}
            >
              Secure access to your station reporting workspace.
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @media (max-width: 640px) {
          .auth-card {
            padding: 28px 24px 24px !important;
          }
        }
      `}</style>
    </div>
  );
}
