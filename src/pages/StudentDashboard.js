import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const StudentDashboard = () => {
  const [classes, setClasses] = useState([]);
  const [grades, setGrades] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userData, setUserData] = useState(null);
  const [finalGrades, setFinalGrades] = useState({});
  const navigate = useNavigate();

  // Get user data from session storage and check role
  useEffect(() => {
    const authData = sessionStorage.getItem('user_auth');
    if (authData) {
      const { user } = JSON.parse(authData);
      if (user.role !== 'student') {
        navigate('/');
        return;
      }
      setUserData(user);
      fetchData(user.id);
    } else {
      navigate('/');
    }
  }, [navigate]);

  const fetchData = async (studentId) => {
    try {
      setLoading(true);
      
      // Fetch classes
      const { data: classesData, error: classesError } = await supabase
        .from('student_enrollment')
        .select('*')
        .eq('student_id', studentId);

      if (classesError) throw classesError;
      setClasses(classesData || []);

      // Fetch grades
      const { data: gradesData, error: gradesError } = await supabase
        .from('grades')
        .select(`
          id,
          score,
          feedback,
          graded_at,
          assignment:assignments (
            id,
            title,
            max_score,
            level_code,
            category:grade_categories (
              name
            )
          )
        `)
        .eq('student_id', studentId)
        .order('graded_at', { ascending: false });

      if (gradesError) throw gradesError;
      setGrades(gradesData || []);
      
      // Calculate final grades
      const calculatedFinalGrades = calculateFinalGrades(gradesData || []);
      setFinalGrades(calculatedFinalGrades);

      // Fetch attendance
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance')
        .select('*')
        .eq('student_id', studentId);

      if (attendanceError) throw attendanceError;
      setAttendance(attendanceData || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Calculate letter grade based on percentage
  const calculateLetterGrade = (percentage) => {
    if (percentage >= 90) return 'A';
    if (percentage >= 80) return 'B';
    if (percentage >= 70) return 'C';
    if (percentage >= 60) return 'D';
    return 'F';
  };

  // Calculate final grades for each level
  const calculateFinalGrades = (gradesData) => {
    const levelGrades = {};
    
    gradesData.forEach(grade => {
      const levelCode = grade.assignment?.level_code;
      if (!levelCode) return;
      
      if (!levelGrades[levelCode]) {
        levelGrades[levelCode] = {
          totalScore: 0,
          maxScore: 0,
          assignments: 0
        };
      }
      
      levelGrades[levelCode].totalScore += grade.score || 0;
      levelGrades[levelCode].maxScore += grade.assignment?.max_score || 0;
      levelGrades[levelCode].assignments += 1;
    });

    // Calculate percentages and letter grades
    Object.keys(levelGrades).forEach(level => {
      const { totalScore, maxScore } = levelGrades[level];
      const percentage = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;
      levelGrades[level].percentage = Math.round(percentage * 100) / 100;
      levelGrades[level].letterGrade = calculateLetterGrade(percentage);
    });

    return levelGrades;
  };

  // Calculate overall statistics
  const getOverallStats = () => {
    const totalAssignments = grades.length;
    const completedAssignments = grades.filter(g => g.score !== null).length;
    const averageScore = grades.length > 0 
      ? grades.reduce((sum, g) => sum + (g.score || 0), 0) / grades.length 
      : 0;
    
    const attendanceRate = attendance.length > 0 
      ? (attendance.filter(a => a.status === 'present').length / attendance.length) * 100 
      : 0;

    return {
      totalAssignments,
      completedAssignments,
      averageScore: Math.round(averageScore * 100) / 100,
      attendanceRate: Math.round(attendanceRate * 100) / 100
    };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-secondary-50 to-neutral-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-6 animate-fade-in">
          <div className="w-16 h-16 loading-spinner"></div>
          <div className="text-center">
            <p className="text-primary-600 font-semibold text-lg">Loading Dashboard...</p>
            <p className="text-neutral-500 text-sm mt-1">Fetching your academic data</p>
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
          <h2 className="text-xl font-bold text-neutral-900 mb-2">Something went wrong</h2>
          <p className="text-neutral-600 mb-6">{error}</p>
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

  const stats = getOverallStats();

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-secondary-50 to-neutral-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-neutral-200 sticky top-16 z-30">
        <div className="container-mobile py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-2xl flex items-center justify-center">
                <span className="text-white font-bold text-lg">
                  {userData?.name?.charAt(0)}
                </span>
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-neutral-900">
                  Welcome back, {userData?.name?.split(' ')[0]}! 👋
                </h1>
                <p className="text-neutral-600 text-sm">Student Dashboard</p>
              </div>
            </div>
            
            <button
              onClick={() => navigate('/')}
              className="btn-ghost p-2"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            </button>
          </div>

          {/* Mobile-friendly tabs */}
          <div className="flex space-x-1 bg-neutral-100 p-1 rounded-2xl mt-6">
            {[
              { id: 'overview', label: 'Overview', icon: '📊' },
              { id: 'classes', label: 'Classes', icon: '🏫' },
              { id: 'grades', label: 'Grades', icon: '📈' },
              { id: 'attendance', label: 'Attendance', icon: '📅' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                  activeTab === tab.id
                    ? 'bg-white text-primary-600 shadow-soft'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                <span className="mr-2 text-base">{tab.icon}</span>
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container-mobile py-6">
        {activeTab === 'overview' && (
          <div className="space-y-6 animate-fade-in">
            {/* Quick Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                {
                  label: 'Classes',
                  value: classes.length,
                  icon: '🏫',
                  color: 'primary',
                  bg: 'from-primary-500 to-primary-600'
                },
                {
                  label: 'Assignments',
                  value: stats.totalAssignments,
                  icon: '📝',
                  color: 'secondary',
                  bg: 'from-secondary-500 to-secondary-600'
                },
                {
                  label: 'Completed',
                  value: stats.completedAssignments,
                  icon: '✅',
                  color: 'success',
                  bg: 'from-success-500 to-success-600'
                },
                {
                  label: 'Avg Score',
                  value: `${stats.averageScore}%`,
                  icon: '📊',
                  color: 'warning',
                  bg: 'from-warning-500 to-warning-600'
                }
              ].map((stat, index) => (
                <div key={index} className="card p-4 animate-slide-up" style={{ animationDelay: `${index * 100}ms` }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-neutral-600">{stat.label}</p>
                      <p className="text-2xl font-bold text-neutral-900">{stat.value}</p>
                    </div>
                    <div className={`w-12 h-12 bg-gradient-to-br ${stat.bg} rounded-2xl flex items-center justify-center`}>
                      <span className="text-white text-xl">{stat.icon}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Recent Grades */}
            <div className="card p-6 animate-slide-up" style={{ animationDelay: '400ms' }}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-neutral-900">Recent Grades</h2>
                <button
                  onClick={() => setActiveTab('grades')}
                  className="btn-ghost text-sm"
                >
                  View All →
                </button>
              </div>
              
              {grades.slice(0, 3).length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-neutral-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <p className="text-neutral-500">No grades available yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {grades.slice(0, 3).map((grade, index) => {
                    const percentage = grade.assignment?.max_score > 0 
                      ? Math.round((grade.score / grade.assignment.max_score) * 100) 
                      : 0;
                    const letterGrade = calculateLetterGrade(percentage);
                    
                    return (
                      <div key={grade.id} className="flex items-center justify-between p-4 bg-neutral-50 rounded-2xl">
                        <div className="flex-1">
                          <h3 className="font-semibold text-neutral-900">{grade.assignment?.title}</h3>
                          <p className="text-sm text-neutral-600">{grade.assignment?.level_code}</p>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-bold text-neutral-900">{grade.score}</span>
                            <span className="text-sm text-neutral-500">/ {grade.assignment?.max_score}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`badge ${
                              letterGrade === 'A' ? 'badge-success' :
                              letterGrade === 'B' ? 'badge-primary' :
                              letterGrade === 'C' ? 'badge-warning' :
                              'badge-error'
                            }`}>
                              {letterGrade}
                            </span>
                            <span className="text-sm text-neutral-500">{percentage}%</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'classes' && (
          <div className="animate-fade-in">
            {classes.length === 0 ? (
              <div className="card p-8 text-center">
                <div className="w-16 h-16 bg-neutral-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-neutral-900 mb-2">No classes enrolled</h3>
                <p className="text-neutral-600">You're not enrolled in any classes yet.</p>
              </div>
            ) : (
              <div className="grid-responsive">
                {classes.map((classItem, index) => (
                  <div key={classItem.id} className="card-hover cursor-pointer animate-slide-up" style={{ animationDelay: `${index * 100}ms` }}>
                    <div className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-2xl flex items-center justify-center">
                          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                        </div>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          <svg className="w-5 h-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                      
                      <h3 className="text-lg font-bold text-neutral-900 mb-2">{classItem.level_code}</h3>
                      
                      <div className="space-y-2 mb-4">
                        <div className="flex items-center text-sm text-neutral-500">
                          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                          </svg>
                          Level: {classItem.level_code}
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between pt-4 border-t border-neutral-100">
                        <span className="text-sm font-medium text-primary-600">View Class →</span>
                        {finalGrades[classItem.level_code] && (
                          <div className="text-right">
                            <div className="text-sm font-bold text-neutral-900">
                              {finalGrades[classItem.level_code].percentage}%
                            </div>
                            <div className={`badge ${
                              finalGrades[classItem.level_code].letterGrade === 'A' ? 'badge-success' :
                              finalGrades[classItem.level_code].letterGrade === 'B' ? 'badge-primary' :
                              finalGrades[classItem.level_code].letterGrade === 'C' ? 'badge-warning' :
                              'badge-error'
                            }`}>
                              {finalGrades[classItem.level_code].letterGrade}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'grades' && (
          <div className="animate-fade-in">
            {grades.length === 0 ? (
              <div className="card p-8 text-center">
                <div className="w-16 h-16 bg-neutral-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-neutral-900 mb-2">No grades available</h3>
                <p className="text-neutral-600">Your grades will appear here once assignments are graded.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {grades.map((grade, index) => {
                  const percentage = grade.assignment?.max_score > 0 
                    ? Math.round((grade.score / grade.assignment.max_score) * 100) 
                    : 0;
                  const letterGrade = calculateLetterGrade(percentage);
                  
                  return (
                    <div key={grade.id} className="card p-6 animate-slide-up" style={{ animationDelay: `${index * 100}ms` }}>
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <h3 className="text-lg font-bold text-neutral-900 mb-1">{grade.assignment?.title}</h3>
                          <p className="text-sm text-neutral-600 mb-2">{grade.assignment?.level_code}</p>
                          {grade.assignment?.category?.name && (
                            <span className="badge badge-neutral">{grade.assignment.category.name}</span>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-2xl font-bold text-neutral-900">{grade.score}</span>
                            <span className="text-sm text-neutral-500">/ {grade.assignment?.max_score}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`badge ${
                              letterGrade === 'A' ? 'badge-success' :
                              letterGrade === 'B' ? 'badge-primary' :
                              letterGrade === 'C' ? 'badge-warning' :
                              'badge-error'
                            }`}>
                              {letterGrade}
                            </span>
                            <span className="text-sm font-medium text-neutral-600">{percentage}%</span>
                          </div>
                        </div>
                      </div>
                      
                      {grade.feedback && (
                        <div className="p-4 bg-neutral-50 rounded-2xl">
                          <p className="text-sm text-neutral-700">{grade.feedback}</p>
                        </div>
                      )}
                      
                      <div className="flex items-center justify-between mt-4 pt-4 border-t border-neutral-100">
                        <span className="text-sm text-neutral-500">
                          Graded on {new Date(grade.graded_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'attendance' && (
          <div className="animate-fade-in">
            {attendance.length === 0 ? (
              <div className="card p-8 text-center">
                <div className="w-16 h-16 bg-neutral-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-neutral-900 mb-2">No attendance records</h3>
                <p className="text-neutral-600">Your attendance records will appear here.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {attendance.map((record, index) => (
                  <div key={record.id} className="card p-6 animate-slide-up" style={{ animationDelay: `${index * 100}ms` }}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                          record.status === 'present' ? 'bg-success-100' : 'bg-error-100'
                        }`}>
                          <span className={`text-xl ${
                            record.status === 'present' ? 'text-success-600' : 'text-error-600'
                          }`}>
                            {record.status === 'present' ? '✅' : '❌'}
                          </span>
                        </div>
                        <div>
                          <h3 className="font-bold text-neutral-900 capitalize">{record.status}</h3>
                          <p className="text-sm text-neutral-600">{record.level_code}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-neutral-900">
                          {new Date(record.date).toLocaleDateString()}
                        </p>
                        <p className="text-xs text-neutral-500">
                          {new Date(record.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default StudentDashboard;
