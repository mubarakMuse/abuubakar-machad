import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function HomePage() {
  const [levels, setLevels] = useState([]);
  const [userLevels, setUserLevels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userData, setUserData] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const navigate = useNavigate();

  useEffect(() => {
    // Get user data
    const authData = sessionStorage.getItem('user_auth');
    if (authData) {
      const { user } = JSON.parse(authData);
      setUserData(user);
    }

    // Update time every minute
    const timeInterval = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timeInterval);
  }, []);

  useEffect(() => {
    if (userData) {
      fetchLevels();
    }
  }, [userData]);

  const fetchLevels = async () => {
    try {
      setLoading(true);
      
      // If user is a student, fetch their enrolled levels
      if (userData?.role === 'student') {
        const { data: enrollmentData, error: enrollmentError } = await supabase
          .from('student_enrollment')
          .select('level_code, level:levels(*)')
          .eq('student_id', userData.id);

        if (enrollmentError) throw enrollmentError;
        setUserLevels(enrollmentData?.map(item => item.level) || []);
      }
      // If user is a teacher, fetch only the levels they teach
      else if (userData?.role === 'instructor') {
        const { data: levelsData, error: levelsError } = await supabase
          .from('levels')
          .select('*')
          .eq('teacher_id', userData.id)
          .order('name', { ascending: true });

        if (levelsError) throw levelsError;
        setLevels(levelsData || []);
      }
      // For other roles (admin, etc.), fetch all levels
      else {
        const { data: levelsData, error: levelsError } = await supabase
          .from('levels')
          .select('*')
          .order('name', { ascending: true });

        if (levelsError) throw levelsError;
        setLevels(levelsData || []);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const getTimeString = () => {
    return currentTime.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-secondary-50 to-neutral-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-6 animate-fade-in">
          <div className="w-16 h-16 loading-spinner"></div>
          <div className="text-center">
            <p className="text-primary-600 font-semibold text-lg">Loading Dashboard...</p>
            <p className="text-neutral-500 text-sm mt-1">Preparing your personalized experience</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-secondary-50 to-neutral-50 flex items-center justify-center container-mobile">
        <div className="card p-8 max-w-md w-full text-center animate-slide-up">
          <div className="w-16 h-16 bg-error-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-error-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-neutral-900 mb-2">Oops! Something went wrong</h2>
          <p className="text-neutral-600 mb-6">Error loading dashboard: {error}</p>
          <button
            onClick={() => window.location.reload()}
            className="btn-primary"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const displayLevels = userData?.role === 'student' ? userLevels : levels;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-secondary-50 to-neutral-50">
      {/* Modern Header with Time and Greeting */}
      <header className="container-mobile py-6 sm:py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-fade-in">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gradient mb-1">
              {getGreeting()}, {userData?.name?.split(' ')[0] || 'Student'}!
            </h1>
            <p className="text-neutral-600 text-sm sm:text-base">
              {getTimeString()} • {currentTime.toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </p>
          </div>
        </div>
      </header>

      {/* Hero Section with Institute Branding */}
      <section className="container-mobile mb-8 sm:mb-12">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-red via-primary-700 to-brand-gold p-8 sm:p-12 text-white">
          {/* Background Pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full -translate-y-32 translate-x-32"></div>
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-white rounded-full translate-y-24 -translate-x-24"></div>
          </div>
          
          <div className="relative z-10">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold mb-1">Abubakar Islamic Institute</h2>
                <p className="text-white/90 text-sm sm:text-base">Excellence in Islamic Education</p>
              </div>
            </div>
            
            <p className="text-lg sm:text-xl text-white/90 mb-6 max-w-2xl">
              {userData?.role === 'student' 
                ? 'Access your classes, track your progress, and stay connected with your learning journey.'
                : 'Manage your classes, engage with students, and foster academic excellence.'
              }
            </p>
          </div>
        </div>
      </section>

      {/* Classes Section */}
      <section className="container-mobile pb-12 sm:pb-16 lg:pb-20">
        <div className="flex items-center justify-between mb-6 sm:mb-8">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-neutral-900 mb-1">
              {userData?.role === 'student' ? 'Your Classes' : 'Your Classes'}
            </h2>
            <p className="text-neutral-600 text-sm sm:text-base">
              {userData?.role === 'student' 
                ? 'Select a class to view updates, assignments, grades, and attendance'
                : 'Select a class to view or post updates'
              }
            </p>
          </div>
          
          {displayLevels.length > 0 && (
            <div className="hidden sm:flex items-center gap-2 text-sm text-neutral-500">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              {displayLevels.length} class{displayLevels.length > 1 ? 'es' : ''}
            </div>
          )}
        </div>

        {displayLevels.length === 0 ? (
          <div className="text-center py-16 animate-fade-in">
            <div className="w-24 h-24 bg-gradient-to-br from-neutral-100 to-neutral-200 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <svg className="w-12 h-12 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-neutral-900 mb-2">
              {userData?.role === 'student' ? 'No classes enrolled' : 'No classes available'}
            </h3>
            <p className="text-neutral-500 max-w-md mx-auto">
              {userData?.role === 'student' 
                ? 'You are not enrolled in any classes yet. Contact your teacher for access.'
                : 'No classroom levels have been created yet.'
              }
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {displayLevels.map((level, index) => (
              <div 
                key={level.id}
                onClick={() => navigate(userData?.role === 'instructor' ? `/level/${level.code}/update` : `/level/${level.code}`)}
                className="group cursor-pointer animate-slide-up"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="bg-white rounded-3xl p-6 border border-neutral-200 hover:border-primary-300 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-14 h-14 bg-gradient-to-br from-brand-red to-brand-gold rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-200 shadow-lg">
                      <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                        <svg className="w-4 h-4 text-primary-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  </div>
                  
                  <h3 className="text-lg font-bold text-neutral-900 mb-3 group-hover:text-primary-700 transition-colors duration-200">
                    {level.name}
                  </h3>
                  
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center text-sm text-neutral-500">
                      <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                      </svg>
                      Level: {level.level || 'N/A'}
                    </div>
                    
                    {level.period && (
                      <div className="flex items-center text-sm text-neutral-500">
                        <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Period: {level.period}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between pt-4 border-t border-neutral-100">
                    <span className="text-sm font-medium text-brand-red group-hover:text-primary-800">
                      {userData?.role === 'student' ? 'View Class & Grades' : 'View Class'}
                    </span>
                    <div className="w-6 h-6 bg-primary-100 rounded-full flex items-center justify-center group-hover:bg-primary-200 transition-colors duration-200">
                      <svg className="w-3 h-3 text-brand-red" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

     
    
    </div>
  );
}
