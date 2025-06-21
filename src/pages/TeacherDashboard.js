import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import AnnouncementsTab from '../components/AnnouncementsTab';
import GradesTab from '../components/GradesTab';
import AssignmentsTab from '../components/AssignmentsTab';
import AttendanceTab from '../components/AttendanceTab';

export default function TeacherDashboard() {
  const { levelCode } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('announcements');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userData, setUserData] = useState(null);
  const [enrolledStudents, setEnrolledStudents] = useState([]);
  const [editingStudent, setEditingStudent] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const checkTeacherAccess = async () => {
      try {
        // Get user data from session storage
        const authData = sessionStorage.getItem('user_auth');
        if (!authData) {
          navigate('/');
          return;
        }

        const { user } = JSON.parse(authData);
        setUserData(user);

        // Check if user is a teacher
        if (user.role !== 'instructor') {
          setError('Only teachers can access this page');
          setLoading(false);
          return;
        }

        // Check if teacher is assigned to this level
        const { data: teacherLevel, error: teacherLevelError } = await supabase
          .from('levels')
          .select('*')
          .eq('code', levelCode)
          .eq('teacher_id', user.id)
          .single();

        if (teacherLevelError || !teacherLevel) {
          setError('You are not authorized to access this level');
          setLoading(false);
          return;
        }

        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    };

    checkTeacherAccess();
  }, [levelCode, navigate]);

  useEffect(() => {
    if (activeTab === 'students') {
      fetchEnrolledStudents();
    }
  }, [activeTab, levelCode]);

  const fetchEnrolledStudents = async () => {
    try {
      const { data, error } = await supabase
        .from('student_enrollment')
        .select(`
          *,
          student:users (
            id,
            name,
            email,
            username,
            role,
            code,
            created_at,
            updated_at
          )
        `)
        .eq('level_code', levelCode);

      if (error) throw error;
      setEnrolledStudents(data.map(item => item.student));
    } catch (err) {
      setError(err.message);
    }
  };

  const handleStudentUpdate = async (studentId, updatedData) => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('users')
        .update(updatedData)
        .eq('id', studentId);

      if (error) throw error;
      await fetchEnrolledStudents();
      setEditingStudent(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-indigo-600"></div>
          <p className="text-indigo-600 font-medium">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
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
            onClick={() => navigate('/')}
            className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  const renderStudentsTab = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
          Enrolled Students
        </h2>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Username</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created At</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {enrolledStudents.map((student) => (
              <tr key={student.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {editingStudent === student.id ? (
                    <input
                      type="text"
                      defaultValue={student.name}
                      className="w-full border rounded px-2 py-1"
                      onBlur={(e) => handleStudentUpdate(student.id, { ...student, name: e.target.value })}
                    />
                  ) : (
                    student.name
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {editingStudent === student.id ? (
                    <input
                      type="text"
                      defaultValue={student.username}
                      className="w-full border rounded px-2 py-1"
                      onBlur={(e) => handleStudentUpdate(student.id, { ...student, username: e.target.value })}
                    />
                  ) : (
                    student.username
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {editingStudent === student.id ? (
                    <input
                      type="email"
                      defaultValue={student.email}
                      className="w-full border rounded px-2 py-1"
                      onBlur={(e) => handleStudentUpdate(student.id, { ...student, email: e.target.value })}
                    />
                  ) : (
                    student.email
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {editingStudent === student.id ? (
                    <select
                      defaultValue={student.role}
                      className="w-full border rounded px-2 py-1"
                      onChange={(e) => handleStudentUpdate(student.id, { ...student, role: e.target.value })}
                    >
                      <option value="student">Student</option>
                      <option value="instructor">Instructor</option>
                      <option value="admin">Admin</option>
                    </select>
                  ) : (
                    student.role
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {editingStudent === student.id ? (
                    <input
                      type="text"
                      defaultValue={student.code}
                      className="w-full border rounded px-2 py-1"
                      onBlur={(e) => handleStudentUpdate(student.id, { ...student, code: e.target.value })}
                    />
                  ) : (
                    student.code
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(student.created_at).toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <button
                    onClick={() => setEditingStudent(editingStudent === student.id ? null : student.id)}
                    className="text-indigo-600 hover:text-indigo-900"
                    disabled={isSubmitting}
                  >
                    {editingStudent === student.id ? 'Save' : 'Edit'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm">
          <nav className="flex space-x-8 px-6">
            {['announcements', 'assignments', 'grades', 'attendance', 'students'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`${
                  activeTab === tab
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm capitalize transition-colors duration-200`}
              >
                {tab}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          {activeTab === 'announcements' && <AnnouncementsTab levelCode={levelCode} teacherId={userData.id} />}
          {activeTab === 'assignments' && <AssignmentsTab levelCode={levelCode} teacherId={userData.id} />}
          {activeTab === 'grades' && <GradesTab levelCode={levelCode} teacherId={userData.id} />}
          {activeTab === 'attendance' && <AttendanceTab levelCode={levelCode} teacherId={userData.id} />}
          {activeTab === 'students' && renderStudentsTab()}
        </div>
      </div>
    </div>
  );
}