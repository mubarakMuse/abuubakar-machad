// src/pages/LevelPage.js
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import ResponsePopup from '../components/ResponsePopup';
import StudentList from '../components/StudentList';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import AssignmentList from '../components/AssignmentList';

export default function LevelPage() {
  const { levelCode } = useParams();
  const navigate = useNavigate();
  const [classData, setClassData] = useState(null);
  const [updates, setUpdates] = useState([]);
  const [responses, setResponses] = useState([]);
  const [grades, setGrades] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showResponsePopup, setShowResponsePopup] = useState(false);
  const [selectedUpdateId, setSelectedUpdateId] = useState(null);
  const [userData, setUserData] = useState(null);
  const [isTeacher, setIsTeacher] = useState(false);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [activeTab, setActiveTab] = useState('updates');

  // Get user data from session storage
  useEffect(() => {
    const authData = sessionStorage.getItem('user_auth');
    if (authData) {
      const { user } = JSON.parse(authData);
      setUserData(user);
      setIsTeacher(user.role === 'teacher');
    }
  }, []);

  // Check enrollment and fetch data when component mounts
  useEffect(() => {
    if (userData) {
      checkEnrollment();
    }
  }, [userData]);

  const checkEnrollment = async () => {
    try {
      setLoading(true);
      
      // If user is a teacher, they have access to all levels
      if (isTeacher) {
        setIsEnrolled(true);
        await fetchData();
        return;
      }

      // For students, check enrollment
      const { data: enrollmentData, error: enrollmentError } = await supabase
        .from('student_enrollment')
        .select('*')
        .eq('level_code', levelCode)
        .eq('student_id', userData.id)
        .single();

      if (enrollmentError || !enrollmentData) {
        setError('You are not enrolled in this class. Please contact your teacher to get access.');
        setLoading(false);
        return;
      }

      setIsEnrolled(true);
      await fetchData();
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch level data
      const { data: classData, error: classError } = await supabase
        .from('levels')
        .select('*')
        .eq('code', levelCode)
        .single();

      if (classError) throw classError;

      // Fetch updates
      const { data: updatesData, error: updatesError } = await supabase
        .from('updates')
        .select('*')
        .eq('level_code', levelCode)
        .order('created_at', { ascending: false });

      if (updatesError) throw updatesError;

      // Fetch responses
      const updateIds = updatesData?.map(u => u.id) || [];
      if (updateIds.length > 0) {
        const { data: responsesData, error: responsesError } = await supabase
          .from('responses')
          .select('*, student:users(name)')
          .in('update_id', updateIds)
          .order('created_at', { ascending: false });

        if (responsesError) throw responsesError;
        setResponses(responsesData || []);
      }

      // Fetch grades for this student and level
      if (!isTeacher && userData) {
        const { data: gradesData, error: gradesError } = await supabase
          .from('grades')
          .select(`
            id,
            score,
            feedback,
            graded_at,
            assignment:assignments!inner (
              id,
              title,
              max_score,
              level_code,
              due_date,
              category:grade_categories (
                name
              )
            )
          `)
          .eq('student_id', userData.id)
          .eq('assignments.level_code', levelCode)
          .order('graded_at', { ascending: false });

        if (gradesError) throw gradesError;
        setGrades(gradesData || []);

        // Fetch attendance for this student
        const { data: attendanceData, error: attendanceError } = await supabase
          .from('attendance')
          .select('*')
          .eq('student_id', userData.id)
          .eq('level_code', levelCode)
          .order('date', { ascending: false });

        if (attendanceError) throw attendanceError;
        setAttendance(attendanceData || []);
      }

      setClassData(classData);
      setUpdates(updatesData || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch responses for a specific update
  const fetchResponses = async (updateId) => {
    try {
      const { data, error } = await supabase
        .from('responses')
        .select('*, student:users(name)')
        .eq('update_id', updateId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setResponses(prev => [
        ...prev.filter(r => r.update_id !== updateId),
        ...data
      ]);
    } catch (err) {
      console.error('Error fetching responses:', err);
    }
  };

  // Calculate letter grade
  const calculateLetterGrade = (percentage) => {
    if (percentage >= 90) return 'A';
    if (percentage >= 80) return 'B';
    if (percentage >= 70) return 'C';
    if (percentage >= 60) return 'D';
    return 'F';
  };

  // Calculate overall grade statistics
  const getGradeStats = () => {
    if (grades.length === 0) return { average: 0, totalAssignments: 0, completedAssignments: 0 };
    
    const totalScore = grades.reduce((sum, grade) => sum + (grade.score || 0), 0);
    const maxPossible = grades.reduce((sum, grade) => sum + (grade.assignment?.max_score || 0), 0);
    const average = maxPossible > 0 ? Math.round((totalScore / maxPossible) * 100) : 0;
    
    return {
      average,
      totalAssignments: grades.length,
      completedAssignments: grades.filter(g => g.score !== null).length
    };
  };

  // Calculate attendance statistics
  const getAttendanceStats = () => {
    if (attendance.length === 0) return { rate: 0, total: 0, present: 0 };
    
    const present = attendance.filter(a => a.status === 'present').length;
    const rate = Math.round((present / attendance.length) * 100);
    
    return {
      rate,
      total: attendance.length,
      present
    };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-secondary-50 to-neutral-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-6 animate-fade-in">
          <div className="w-16 h-16 loading-spinner"></div>
          <div className="text-center">
            <p className="text-primary-600 font-semibold text-lg">Loading Class...</p>
            <p className="text-neutral-500 text-sm mt-1">Fetching your class information</p>
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
          <h2 className="text-xl font-bold text-neutral-900 mb-2">Access Denied</h2>
          <p className="text-neutral-600 mb-6">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="btn-primary w-full"
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  if (!classData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-secondary-50 to-neutral-50 flex items-center justify-center container-mobile">
        <div className="card p-8 max-w-md w-full text-center animate-slide-up">
          <div className="w-16 h-16 bg-warning-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-warning-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-neutral-900 mb-2">Class Not Found</h2>
          <p className="text-neutral-600">The requested class could not be found.</p>
        </div>
      </div>
    );
  }

  const gradeStats = getGradeStats();
  const attendanceStats = getAttendanceStats();

  // Define tabs based on user role
  const tabs = [
    { id: 'updates', label: 'Updates', icon: '📢' },
    { id: 'assignments', label: 'Assignments', icon: '📝' },
    { id: 'grades', label: 'Grades', icon: '📊' },
    { id: 'attendance', label: 'Attendance', icon: '📅' },
    ...(isTeacher ? [{ id: 'students', label: 'Students', icon: '👥' }] : [])
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-secondary-50 to-neutral-50">
      {/* Class Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-neutral-200 sticky top-16 z-30">
        <div className="container-mobile py-6">
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={() => navigate('/')}
              className="p-2 hover:bg-neutral-100 rounded-xl transition-colors duration-200"
            >
              <svg className="w-6 h-6 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-2xl flex items-center justify-center">
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gradient">
                {classData.name}
              </h1>
              <p className="text-neutral-600 mt-1">Period: {classData.period}</p>
            </div>
          </div>

          {/* Quick Stats for Students */}
          {!isTeacher && (
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="text-center p-3 bg-white rounded-2xl shadow-soft">
                <div className="text-lg font-bold text-primary-600">{gradeStats.average}%</div>
                <div className="text-xs text-neutral-600">Average</div>
              </div>
              <div className="text-center p-3 bg-white rounded-2xl shadow-soft">
                <div className="text-lg font-bold text-success-600">{gradeStats.completedAssignments}</div>
                <div className="text-xs text-neutral-600">Completed</div>
              </div>
              <div className="text-center p-3 bg-white rounded-2xl shadow-soft">
                <div className="text-lg font-bold text-warning-600">{attendanceStats.rate}%</div>
                <div className="text-xs text-neutral-600">Attendance</div>
              </div>
            </div>
          )}

          {/* Mobile-friendly tabs */}
          <div className="flex space-x-1 bg-neutral-100 p-1 rounded-2xl">
            {tabs.map((tab) => (
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
        {activeTab === 'updates' && (
          <section className="animate-fade-in">
            {updates.length === 0 ? (
              <div className="card p-8 text-center">
                <div className="w-16 h-16 bg-primary-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-neutral-900 mb-2">No updates yet</h3>
                <p className="text-neutral-600">Your teacher hasn't posted any updates for this class.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {updates.map((update, index) => (
                  <div key={update.id} className="card p-6 animate-slide-up" style={{ animationDelay: `${index * 100}ms` }}>
                    <div className="flex items-start justify-between mb-4">
                      <h3 className="text-lg font-bold text-neutral-900">{update.title}</h3>
                      <span className="text-sm text-neutral-500 whitespace-nowrap ml-4">
                        {new Date(update.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                    
                    <div className="prose prose-sm max-w-none mb-6">
                      <p className="text-neutral-700 whitespace-pre-line leading-relaxed">{update.content}</p>
                    </div>
                    
                    <div className="flex items-center justify-between pt-4 border-t border-neutral-100">
                      <button
                        onClick={() => {
                          setSelectedUpdateId(update.id);
                          setShowResponsePopup(true);
                        }}
                        className="btn-primary text-sm px-4 py-2"
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        Add Response
                      </button>
                      
                      <span className="text-sm text-neutral-500">
                        {responses.filter(r => r.update_id === update.id).length} response(s)
                      </span>
                    </div>
                    
                    {/* Display Responses */}
                    {responses.filter(response => response.update_id === update.id).length > 0 && (
                      <div className="mt-6 space-y-4">
                        {responses.filter(response => response.update_id === update.id)
                          .map(response => (
                            <div key={response.id} className="bg-neutral-50 rounded-2xl p-4 animate-slide-up">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                                    <span className="text-primary-600 font-semibold text-sm">
                                      {response.student?.name?.charAt(0)}
                                    </span>
                                  </div>
                                  <div>
                                    <h4 className="font-semibold text-neutral-900 text-sm">{response.title}</h4>
                                    <p className="text-xs text-neutral-500">
                                      {response.student?.name || 'Unknown'} • {new Date(response.created_at).toLocaleDateString()}
                                    </p>
                                  </div>
                                </div>
                              </div>
                              <div className="prose prose-sm max-w-none">
                                <ReactMarkdown rehypePlugins={[rehypeSanitize]}>
                                  {response.content}
                                </ReactMarkdown>
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {activeTab === 'assignments' && (
          <section className="animate-fade-in">
            <AssignmentList 
              levelCode={levelCode} 
              studentId={userData?.id}
              isTeacher={isTeacher}
              teacherId={userData?.id}
              username={userData?.username}
              name={userData?.name}
            />
          </section>
        )}

        {activeTab === 'grades' && !isTeacher && (
          <section className="animate-fade-in">
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
          </section>
        )}

        {activeTab === 'attendance' && !isTeacher && (
          <section className="animate-fade-in">
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
          </section>
        )}

        {activeTab === 'students' && isTeacher && (
          <section className="animate-fade-in">
            <StudentList levelCode={classData.code} />
          </section>
        )}
      </main>

      {/* Response Popup */}
      {showResponsePopup && (
        <ResponsePopup 
          updateId={selectedUpdateId}
          onClose={() => setShowResponsePopup(false)}
          studentId={userData?.id}
          onResponseSubmitted={async () => {
            await fetchResponses(selectedUpdateId);
          }}
          username={userData?.username}
          name={userData?.name}
        />
      )}
    </div>
  );
}
