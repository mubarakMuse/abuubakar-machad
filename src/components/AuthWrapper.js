import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

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
        // Check if 20 minutes have passed
        if (Date.now() - timestamp < 20 * 60 * 1000) {
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
        const timeRemaining = 20 * 60 * 1000 - (Date.now() - timestamp);
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

  // Password Modal Component
  const PasswordModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Enter Your Code</h2>
          <p className="text-gray-600 mt-2">Please enter your access code to continue</p>
        </div>

        {passwordError && (
          <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 rounded">
            <p className="text-red-700">{passwordError}</p>
          </div>
        )}

        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <div>
            <input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Enter your access code"
              required
              autoFocus
            />
          </div>

          <button
            type="submit"
            className="w-full px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Login
          </button>
        </form>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-indigo-600"></div>
          <p className="text-indigo-600 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  if (showPasswordModal) {
    return <PasswordModal />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with user info and logout button */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center">
                <span className="text-indigo-600 font-medium">
                  {userData?.name?.charAt(0)}
                </span>
              </div>
              <div>
                <p className="font-medium text-gray-900">{userData?.name}</p>
                <p className="text-sm text-gray-500">@{userData?.username}</p>
              </div>
              {userData?.role === 'student' && (
                <button
                  onClick={() => window.location.href = '/student'}
                  className="ml-2 px-2 py-1 text-xs border border-green-600 text-green-700 rounded hover:bg-green-50 transition"
                  title="Go to your dashboard"
                >
                  Dashboard
                </button>
              )}
            </div>
            <div className="flex items-center space-x-4">
              {timeLeft && (
                <div className="text-sm text-gray-500">
                  Session expires in: <span className="font-medium text-indigo-600">{timeLeft}</span>
                </div>
              )}
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="">
        {children}
      </main>
    </div>
  );
} 