import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import SignInPanel from '../components/SignInPanel';
import SignUpPanel from '../components/SignUpPanel';

export default function Auth() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isSignIn, setIsSignIn] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    // Check for reduced motion preference
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mediaQuery.matches);

    const handleChange = () => setReducedMotion(mediaQuery.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    // Sync state with current route
    const currentPath = location.pathname;
    if (currentPath === '/signup' && isSignIn) {
      setIsSignIn(false);
    } else if (currentPath === '/signin' && !isSignIn) {
      setIsSignIn(true);
    }
  }, [location.pathname, isSignIn]);

  const handleSignUp = () => {
    if (reducedMotion) {
      navigate('/signup');
      setIsSignIn(false);
      return;
    }

    navigate('/signup');
    setIsSignIn(false);
  };

  const handleSignIn = () => {
    if (reducedMotion) {
      navigate('/signin');
      setIsSignIn(true);
      return;
    }

    navigate('/signin');
    setIsSignIn(true);
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

      {/* Authentication panel container */}
      <div
        className="relative w-full px-4"
        style={{
          maxWidth: '440px',
          minWidth: '0',
        }}
      >
        {/* Outer div gives the container a real height equal to whichever panel is active */}
        <div className="relative" style={{ minHeight: '480px' }}>
          <div
            className="relative"
            style={{
              transition: reducedMotion ? 'none' : 'transform 400ms cubic-bezier(0.4, 0, 0.2, 1)',
              transform: isSignIn ? 'translateX(0)' : 'translateX(-100%)',
            }}
          >
            {/* Sign In Panel */}
            <div
              className="absolute top-0 left-0 w-full"
              style={{
                opacity: isSignIn ? 1 : 0,
                transition: reducedMotion ? 'none' : 'opacity 400ms cubic-bezier(0.4, 0, 0.2, 1)',
                pointerEvents: isSignIn ? 'auto' : 'none',
              }}
            >
              <SignInPanel onSignUp={handleSignUp} />
            </div>

            {/* Sign Up Panel — rendered inline (not absolute) when active so it sets container height */}
            <div
              style={{
                opacity: !isSignIn ? 1 : 0,
                transition: reducedMotion ? 'none' : 'opacity 400ms cubic-bezier(0.4, 0, 0.2, 1)',
                pointerEvents: !isSignIn ? 'auto' : 'none',
                visibility: !isSignIn ? 'visible' : 'hidden',
              }}
            >
              <SignUpPanel onSignIn={handleSignIn} />
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 640px) {
          .auth-card {
            padding: 26px 24px 24px !important;
          }
        }
      `}</style>
    </div>
  );
}
