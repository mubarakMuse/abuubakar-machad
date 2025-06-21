import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
// import DashboardNavbar from "../components/DashboardNavbar";
import { supabase } from '../lib/supabase';

const StudentDashboard = () => {
  const [classes, setClasses] = useState([]);
  const [grades, setGrades] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [activeTab, setActiveTab] = useState('grades');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userData, setUserData] = useState(null);
  const navigate = useNavigate();

  // Get user data from session storage and check role
  useEffect(() => {
    const authData = sessionStorage.getItem('user_auth');
    if (authData) {
      const { user } = JSON.parse(authData);
      if (user.role !== 'student') {
        // Redirect non-students to home page
        navigate('/');
        return;
      }
      setUserData(user);
      fetchData(user.id);
    } else {
      // Redirect unauthenticated users to home page
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

  // Student Info Component
  const StudentInfo = () => (
    <div className="bg-white p-6 rounded-lg shadow mb-6">
      <h2 className="text-2xl font-bold mb-4 text-gray-800">Student Information</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium text-gray-500">Full Name</label>
            <p className="text-lg text-gray-800">{userData?.name || 'N/A'}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-500">Student ID</label>
            <p className="text-lg text-gray-800">{userData?.id || 'N/A'}</p>
          </div>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium text-gray-500">Username</label>
            <p className="text-lg text-gray-800">{userData?.username || 'N/A'}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-500">Role</label>
            <p className="text-lg text-gray-800 capitalize">{userData?.role || 'N/A'}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {classes.length > 0 ? (
              classes.map((c) => (
                <div
                  key={c.id}
                  className="bg-white border border-gray-100 p-6 shadow-lg rounded-2xl transition-transform transform hover:scale-105 hover:shadow-2xl flex flex-col items-center"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">📚</span>
                    <h2 className="text-2xl font-bold tracking-tight text-gray-800">{c.level_code}</h2>
                  </div>
                  <p className="text-gray-500 text-sm mb-6">{c.trimester}</p>
                  <Link
                    to={`/level/${c.level_code}`}
                    className="w-full text-center mt-auto bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white py-2 rounded-lg font-semibold shadow transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  >
                    View Class
                  </Link>
                </div>
              ))
            ) : (
              <p className="text-gray-600 text-center">You are not enrolled in any classes.</p>
            )}
          </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const renderTabContent = () => {
    if (error) {
      return (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4">
          <p>Error: {error}</p>
        </div>
      );
    }

    switch (activeTab) {
      case 'grades':
        return (
          <div className="bg-white p-6 rounded shadow">
            <h2 className="text-2xl font-semibold mb-4">Your Grades</h2>
            {grades.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="px-4 py-2 text-left">Assignment</th>
                      <th className="px-4 py-2 text-left">Level</th>
                      <th className="px-4 py-2 text-left">Type</th>
                      <th className="px-4 py-2 text-left">Score</th>
                      <th className="px-4 py-2 text-left">Feedback</th>
                      <th className="px-4 py-2 text-left">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grades.map((grade) => (
                      <tr key={grade.id} className="border-b">
                        <td className="px-4 py-2 text-left">{grade.assignment?.title}</td>
                        <td className="px-4 py-2 text-left">{grade.assignment?.level_code}</td>
                        <td className="px-4 py-2 text-left">{grade.assignment?.category?.name || '-'}</td>
                        <td className="px-4 py-2 text-left">{grade.score} / {grade.assignment?.max_score}</td>
                        <td className="px-4 py-2 text-left">{grade.feedback || '-'}</td>
                        <td className="px-4 py-2 text-left">{new Date(grade.graded_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-600 text-center">No grades available.</p>
            )}
          </div>
        );

      case 'attendance':
        return (
          <div className="bg-white p-6 rounded shadow">
            <h2 className="text-2xl font-semibold mb-4">Attendance Record</h2>
            {attendance.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="px-4 py-2 text-left">Date</th>
                      <th className="px-4 py-2 text-left">Subject</th>
                      <th className="px-4 py-2 text-left">Status</th>
                      <th className="px-4 py-2 text-left">Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendance.map((record) => (
                      <tr key={record.id} className="border-b">
                        <td className="px-4 py-2 text-left">{new Date(record.date).toLocaleDateString()}</td>
                        <td className="px-4 py-2 text-left">{record.level_code}</td>
                        <td className="px-4 py-2 text-left">
                          <span className={`px-2 py-1 rounded ${
                            record.status === 'present' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {record.status}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-left">{record.remarks || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-600 text-center">No attendance records available.</p>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6 text-center">Student Dashboard</h1>
      
      {/* Add Student Info section */}
      <StudentInfo />

      {/* Navigation Tabs */}
      <div className="flex justify-center mb-8">
        <div className="inline-flex rounded-md shadow-sm">
      
          <button
            onClick={() => setActiveTab('grades')}
            className={`px-4 py-2 text-sm font-medium ${
              activeTab === 'grades'
                ? 'bg-blue-500 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            Grades
          </button>
          <button
            onClick={() => setActiveTab('attendance')}
            className={`px-4 py-2 text-sm font-medium rounded-r-lg ${
              activeTab === 'attendance'
                ? 'bg-blue-500 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            Attendance
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {renderTabContent()}
    </div>
  );
};

export default StudentDashboard;