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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showResponsePopup, setShowResponsePopup] = useState(false);
  const [selectedUpdateId, setSelectedUpdateId] = useState(null);
  const [userData, setUserData] = useState(null);
  const [isTeacher, setIsTeacher] = useState(false);
  const [isEnrolled, setIsEnrolled] = useState(false);

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
      
      // Fetch level data using code instead of id
      const { data: classData, error: classError } = await supabase
        .from('levels')
        .select('*')
        .eq('code', levelCode)
        .single();

      if (classError) throw classError;

      // Fetch updates using the level id from the fetched data
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

      // Merge new responses with existing ones
      setResponses(prev => [
        ...prev.filter(r => r.update_id !== updateId),
        ...data
      ]);
    } catch (err) {
      console.error('Error fetching responses:', err);
    }
  };

  if (loading) return (
    <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      <div className="flex flex-col items-center gap-4">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-indigo-600"></div>
        <p className="text-indigo-600 font-medium">Loading class information...</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg p-6 max-w-md w-full border-l-4 border-red-500">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
            <svg className="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900">Access Denied</h2>
        </div>
        <p className="text-gray-600 mb-4">{error}</p>
        <button
          onClick={() => navigate('/student')}
          className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Return to Dashboard
        </button>
      </div>
    </div>
  );

  if (!classData) return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg p-6 max-w-md w-full border-l-4 border-yellow-500">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-full bg-yellow-100 flex items-center justify-center">
            <svg className="h-6 w-6 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900">Not Found</h2>
        </div>
        <p className="text-gray-600">Class not found</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Class Header */}
        <header className="bg-white rounded-2xl shadow-lg p-8 mb-8 border border-indigo-100">
          <div className="flex items-center gap-4 mb-4">
            <div className="h-12 w-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                {classData.name}
              </h1>
              <p className="text-lg text-gray-600 mt-1">Period: {classData.period}</p>
            </div>
          </div>
        </header>

        {/* Updates Section */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">Class Updates</h2>
          </div>
          
          {updates.length === 0 ? (
            <div className="bg-white rounded-xl p-6 shadow-md border border-indigo-100">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <svg className="h-6 w-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-blue-700 font-medium">No updates yet for this class.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {updates.map((update) => (
                <div key={update.id} className="bg-white rounded-xl shadow-md overflow-hidden border border-indigo-100 hover:shadow-lg transition-shadow duration-200">
                  <div className="p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">{update.title}</h3>
                    <p className="text-gray-800 whitespace-pre-line leading-relaxed">{update.content}</p>
                    <div className="flex items-center gap-2 mt-4 text-sm text-gray-500">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>
                        {new Date(update.created_at).toLocaleDateString('en-US', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                    
                    {/* Response Button */}
                    <button
                      onClick={() => {
                        setSelectedUpdateId(update.id);
                        setShowResponsePopup(true);
                      }}
                      className="mt-4 px-3 py-1 bg-indigo-100 text-indigo-700 rounded-md text-sm hover:bg-indigo-200 transition-colors"
                    >
                      Add Response
                    </button>
                    
                    {/* Display Responses */}
                    {responses.filter(response => response.update_id === update.id)
                      .map(response => (
                        <div key={response.id} className="bg-white rounded-lg shadow-sm p-4 mb-3">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <h4 className="font-medium text-gray-900">{response.title}</h4>
                              <p className="text-sm text-gray-500">
                                By {response.student?.name || 'Unknown'} • {new Date(response.created_at).toLocaleDateString()}
                              </p>
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
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Add the assignments section */}
        <div className="mt-8">
          <AssignmentList 
            levelCode={levelCode} 
            studentId={userData?.id}
            isTeacher={isTeacher}
            teacherId={userData?.id}
            username={userData?.username}
            name={userData?.name}
          />
        </div>

        {/* Only show student list to teachers */}
        {isTeacher && (
          <section className="mt-12 bg-white rounded-xl shadow-md p-6 border border-indigo-100">
            <StudentList levelCode={classData.code} />
          </section>
        )}
      </div>
 
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