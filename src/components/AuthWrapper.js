import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import BottomNav from './ui/BottomNav';

export default function AuthWrapper({ children }) {
  const [userData, setUserData] = useState(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState(null);

  // Check authentication status
  useEffect(() => {
    const checkAuth = async () => {
      const authData = sessionStorage.getItem('user_auth');
      if (authData) {
        const { timestamp, user } = JSON.parse(authData);
        // Check if 1 hour have passed
        if (Date.now() - timestamp < 60 * 60 * 1000) {
          // Still valid, set user data
          setUserData(user);
          setLoading(false);
          return;
        } else {
          // Expired, remove from session
          sessionStorage.removeItem('user_auth');
        }
      }
      // Not authenticated or expired, show password modal
      setShowPasswordModal(true);
      setLoading(false);
    };

    checkAuth();
  }, []);

  // Timer effect
  useEffect(() => {
    if (!userData) return;

    const updateTimer = () => {
      const authData = sessionStorage.getItem('user_auth');
      if (authData) {
        const { timestamp } = JSON.parse(authData);
        const timeRemaining = 60 * 60 * 1000 - (Date.now() - timestamp);
        if (timeRemaining > 0) {
          const minutes = Math.floor(timeRemaining / 60000);
          const seconds = Math.floor((timeRemaining % 60000) / 1000);
          setTimeLeft(`${minutes}:${seconds.toString().padStart(2, '0')}`);
        } else {
          handleLogout();
        }
      }
    };

    updateTimer();
    const timerInterval = setInterval(updateTimer, 1000);

    return () => clearInterval(timerInterval);
  }, [userData]);

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordError(null);

    try {
      // Check the users table for the code (passcode)
      const { data: userData, error } = await supabase
        .from('users')
        .select('id, name, username, role, code')
        .eq('code', password)
        .single();

      if (error) throw error;

      if (userData) {
        // Store in session storage
        sessionStorage.setItem('user_auth', JSON.stringify({
          timestamp: Date.now(),
          user: userData
        }));
        
        setUserData(userData);
        setShowPasswordModal(false);
      } else {
        setPasswordError('Invalid code');
      }
    } catch (err) {
      setPasswordError(err.message);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('user_auth');
    setUserData(null);
    setShowPasswordModal(true);
  };

  // Modern Password Modal Component
  const PasswordModal = () => (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 safe-top safe-bottom">
      <div className="bg-white rounded-3xl shadow-large w-full max-w-md p-8 animate-scale-in">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-neutral-900 mb-2">Welcome Back</h2>
          <p className="text-neutral-600">Enter your access code to continue</p>
        </div>

        {passwordError && (
          <div className="mb-6 p-4 bg-error-50 border border-error-200 rounded-xl animate-slide-down">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-error-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-error-700 text-sm font-medium">{passwordError}</p>
            </div>
          </div>
        )}

        <form onSubmit={handlePasswordSubmit} className="space-y-6">
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-neutral-700 mb-2">
              Access Code
            </label>
            <input
              id="password"
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input text-center text-lg tracking-wider"
              placeholder="Enter your code"
              required
              autoFocus
            />
          </div>

          <button
            type="submit"
            className="btn-primary w-full py-3 text-base font-semibold"
          >
            Sign In
          </button>
        </form>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-primary-50 via-secondary-50 to-neutral-50">
        <div className="flex flex-col items-center gap-6 animate-fade-in">
          <div className="w-16 h-16 loading-spinner"></div>
          <div className="text-center">
            <p className="text-primary-600 font-semibold text-lg">Loading...</p>
            <p className="text-neutral-500 text-sm mt-1">Please wait while we set things up</p>
          </div>
        </div>
      </div>
    );
  }

  if (showPasswordModal) {
    return <PasswordModal />;
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Modern Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-neutral-200 sticky top-0 z-40 safe-top">
        <div className="container-mobile py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-sm">
                  {userData?.name?.charAt(0)}
                </span>
              </div>
              <div className="hidden sm:block">
                <p className="font-semibold text-neutral-900">{userData?.name}</p>
                <p className="text-sm text-neutral-500">@{userData?.username}</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              {timeLeft && (
                <div className="hidden md:flex items-center text-sm text-neutral-500">
                  <div className="w-2 h-2 bg-warning-500 rounded-full mr-2 animate-pulse"></div>
                  <span className="font-medium text-warning-600">{timeLeft}</span>
                </div>
              )}
              
              <button
                onClick={handleLogout}
                className="btn-ghost text-sm px-3 py-2"
              >
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content with mobile padding */}
      <main className="safe-bottom pb-20">
        {children}
      </main>

      {/* Mobile Bottom Navigation */}
    </div>
  );
}
