import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import AnnouncementsTab from '../components/AnnouncementsTab';
import GradesTab from '../components/GradesTab';
import AssignmentsTab from '../components/AssignmentsTab';
import AttendanceTab from '../components/AttendanceTab';
import AddStudentModal from '../components/AddStudentModal';

export default function TeacherDashboard() {
  const { levelCode } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('summary');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userData, setUserData] = useState(null);
  const [classData, setClassData] = useState(null);
  const [enrolledStudents, setEnrolledStudents] = useState([]);
  const [editingStudent, setEditingStudent] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalAssignments: 0,
    pendingGrades: 0,
    attendanceRate: 0,
    recentActivity: 0
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [studentStats, setStudentStats] = useState({});

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

        // Check if user is a teacher or admin
        if (user.role !== 'instructor' && user.role !== 'admin') {
          setError('Only teachers and admins can access this page');
          setLoading(false);
          return;
        }

        // Check if teacher is assigned to this level and get class data
        // For admin users, skip the teacher_id check
        let teacherLevel, teacherLevelError;
        
        if (user.role === 'admin') {
          // Admin can access any level
          const { data, error } = await supabase
            .from('levels')
            .select('*')
            .eq('code', levelCode)
            .single();
          teacherLevel = data;
          teacherLevelError = error;
        } else {
          // Regular teacher must be assigned to the level
          const { data, error } = await supabase
            .from('levels')
            .select('*')
            .eq('code', levelCode)
            .eq('teacher_id', user.id)
            .single();
          teacherLevel = data;
          teacherLevelError = error;
        }

        if (teacherLevelError || !teacherLevel) {
          setError('You are not authorized to access this level');
          setLoading(false);
          return;
        }

        setClassData(teacherLevel);
        await fetchDashboardData();
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
    } else if (activeTab === 'summary') {
      fetchEnrolledStudents();
      fetchStudentStats();
    }
  }, [activeTab, levelCode]);

  const fetchDashboardData = async () => {
    try {
      // Fetch students
      const { data: studentsData } = await supabase
        .from('student_enrollment')
        .select('student_id')
        .eq('level_code', levelCode);

      // Fetch assignments
      const { data: assignmentsData } = await supabase
        .from('assignments')
        .select('*')
        .eq('level_code', levelCode);

      // Fetch grades
      const { data: gradesData } = await supabase
        .from('grades')
        .select('*')
        .in('assignment_id', assignmentsData?.map(a => a.id) || []);

      // Fetch attendance
      const { data: attendanceData } = await supabase
        .from('attendance')
        .select('*')
        .eq('level_code', levelCode)
        .gte('date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

      // Calculate stats
      const totalStudents = studentsData?.length || 0;
      const totalAssignments = assignmentsData?.length || 0;
      const pendingGrades = assignmentsData?.filter(a => 
        !gradesData?.some(g => g.assignment_id === a.id)
      ).length || 0;
      
      const attendanceRate = attendanceData?.length > 0 
        ? (attendanceData.filter(a => a.status === 'present').length / attendanceData.length) * 100
        : 0;

      setStats({
        totalStudents,
        totalAssignments,
        pendingGrades,
        attendanceRate: Math.round(attendanceRate),
        recentActivity: 0
      });

      // Fetch recent activity (simplified for now)
      setRecentActivity([
        { type: 'assignment', message: 'New assignment posted', time: '2 hours ago' },
        { type: 'grade', message: 'Grades updated for Quiz 1', time: '1 day ago' },
        { type: 'attendance', message: 'Attendance marked for today', time: '2 days ago' }
      ]);

    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    }
  };

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

  const fetchStudentStats = async () => {
    try {
      const stats = {};
      
      // Fetch grades for all students
      const { data: grades, error: gradesError } = await supabase
        .from('grades')
        .select(`
          *,
          assignment:assignments!inner(*),
          student:users(name)
        `)
        .eq('assignment.level_code', levelCode);

      if (gradesError) throw gradesError;

      // Fetch attendance for all students
      const { data: attendance, error: attendanceError } = await supabase
        .from('attendance')
        .select('*')
        .eq('level_code', levelCode);

      if (attendanceError) throw attendanceError;

      // Sort students alphabetically by name
      const sortedStudents = [...enrolledStudents].sort((a, b) => a.name.localeCompare(b.name));
      
      // Calculate stats for each student
      sortedStudents.forEach(student => {
        const studentGrades = grades.filter(grade => grade.student_id === student.id);
        const studentAttendance = attendance.filter(record => record.student_id === student.id);
        
        // Calculate grade stats
        const totalScore = studentGrades.reduce((sum, grade) => sum + (grade.score || 0), 0);
        const maxPossible = studentGrades.reduce((sum, grade) => sum + (grade.assignment?.max_score || 0), 0);
        const gradePercentage = maxPossible > 0 ? Math.round((totalScore / maxPossible) * 100) : 0;
        
        // Calculate attendance stats
        const attendanceStats = {
          present: 0,
          absent: 0,
          late: 0,
          excused: 0,
          total: studentAttendance.length
        };
        
        studentAttendance.forEach(record => {
          if (record.status) {
            attendanceStats[record.status] = (attendanceStats[record.status] || 0) + 1;
          }
        });
        
        // Calculate weighted attendance percentage (excused counts as 1 point like present)
        const weightedScore = attendanceStats.present + attendanceStats.excused + (attendanceStats.late * 0.5);
        const attendancePercentage = attendanceStats.total > 0 ? Math.round((weightedScore / attendanceStats.total) * 100) : 0;
        
        stats[student.id] = {
          name: student.name,
          username: student.username,
          gradePercentage,
          totalScore,
          maxPossible,
          attendancePercentage,
          attendanceStats
        };
      });
      
      setStudentStats(stats);
    } catch (err) {
      console.error('Error fetching student stats:', err);
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

  const handleStudentAdded = () => {
    fetchEnrolledStudents();
    fetchDashboardData(); // Update stats
  };

  const handleRemoveStudent = async (studentId) => {
    if (window.confirm('Are you sure you want to remove this student from the class?')) {
      try {
        const { error } = await supabase
          .from('student_enrollment')
          .delete()
          .eq('student_id', studentId)
          .eq('level_code', levelCode);

        if (error) throw error;
        await fetchEnrolledStudents();
        await fetchDashboardData(); // Update stats
      } catch (err) {
        setError(err.message);
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-secondary-50 to-neutral-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-6 animate-fade-in">
          <div className="w-16 h-16 loading-spinner"></div>
          <div className="text-center">
            <p className="text-primary-600 font-semibold text-lg">Loading Dashboard...</p>
            <p className="text-neutral-500 text-sm mt-1">Preparing your teaching tools</p>
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
            className="btn-primary"
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  const renderStudentsTab = () => (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gradient">Student Management</h2>
          <p className="text-neutral-600 mt-1">Manage enrolled students and their information</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-neutral-500">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            {enrolledStudents.length} student{enrolledStudents.length !== 1 ? 's' : ''}
          </div>
          <button
            onClick={() => setShowAddStudentModal(true)}
            className="btn-primary px-4 py-2 text-sm font-semibold"
          >
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Add Students
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-error-50 border border-error-200 rounded-2xl p-4">
          <p className="text-error-700">{error}</p>
        </div>
      )}

      <div className="bg-white rounded-3xl border border-neutral-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-neutral-200">
            <thead className="bg-neutral-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Student</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Contact</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Code</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Joined</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-neutral-200">
              {enrolledStudents.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-16 h-16 bg-neutral-100 rounded-2xl flex items-center justify-center">
                        <svg className="w-8 h-8 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-neutral-900 mb-2">No students enrolled yet</h3>
                        <p className="text-neutral-500 mb-4">Add students to get started with your class.</p>
                        <button
                          onClick={() => setShowAddStudentModal(true)}
                          className="btn-primary"
                        >
                          Add Your First Student
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                [...enrolledStudents].sort((a, b) => a.name.localeCompare(b.name)).map((student) => (
                  <tr key={student.id} className="hover:bg-neutral-50 transition-colors duration-200">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-xl flex items-center justify-center">
                          <span className="text-white font-semibold text-sm">
                            {student.name?.charAt(0)?.toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <div className="text-sm font-medium text-neutral-900">
                            {editingStudent === student.id ? (
                              <input
                                type="text"
                                defaultValue={student.name}
                                className="w-full border border-neutral-300 rounded-lg px-3 py-1 text-sm"
                                onBlur={(e) => handleStudentUpdate(student.id, { ...student, name: e.target.value })}
                              />
                            ) : (
                              student.name
                            )}
                          </div>
                          <div className="text-sm text-neutral-500">
                            {editingStudent === student.id ? (
                              <input
                                type="text"
                                defaultValue={student.username}
                                className="w-full border border-neutral-300 rounded-lg px-3 py-1 text-sm"
                                onBlur={(e) => handleStudentUpdate(student.id, { ...student, username: e.target.value })}
                              />
                            ) : (
                              student.username
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-neutral-500">
                        {editingStudent === student.id ? (
                          <input
                            type="email"
                            defaultValue={student.email}
                            className="w-full border border-neutral-300 rounded-lg px-3 py-1 text-sm"
                            onBlur={(e) => handleStudentUpdate(student.id, { ...student, email: e.target.value })}
                          />
                        ) : (
                          student.email
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-neutral-500">
                        {editingStudent === student.id ? (
                          <input
                            type="text"
                            defaultValue={student.code}
                            className="w-full border border-neutral-300 rounded-lg px-3 py-1 text-sm"
                            onBlur={(e) => handleStudentUpdate(student.id, { ...student, code: e.target.value })}
                          />
                        ) : (
                          <span className="bg-neutral-100 text-neutral-700 px-2 py-1 rounded-lg text-xs font-medium">
                            {student.code}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500">
                      {new Date(student.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setEditingStudent(editingStudent === student.id ? null : student.id)}
                          className="text-primary-600 hover:text-primary-700 font-medium transition-colors duration-200"
                          disabled={isSubmitting}
                        >
                          {editingStudent === student.id ? 'Save' : 'Edit'}
                        </button>
                        <button
                          onClick={() => handleRemoveStudent(student.id)}
                          className="text-error-600 hover:text-error-700 font-medium transition-colors duration-200"
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderSummaryTab = () => {
    const studentStatsArray = Object.values(studentStats).sort((a, b) => a.name.localeCompare(b.name));
    
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-neutral-900 mb-2">Student Summary</h2>
          <p className="text-neutral-600">Quick overview of all students' performance and attendance</p>
        </div>

        {/* Class Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-6 border border-blue-200">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                </svg>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-900">{enrolledStudents.length}</div>
                <div className="text-sm text-blue-700">Total Students</div>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-2xl p-6 border border-green-200">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-900">
                  {studentStatsArray.length > 0 ? Math.round(studentStatsArray.reduce((sum, s) => sum + s.gradePercentage, 0) / studentStatsArray.length) : 0}%
                </div>
                <div className="text-sm text-green-700">Avg Grade</div>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-2xl p-6 border border-yellow-200">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-yellow-500 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <div className="text-2xl font-bold text-yellow-900">
                  {studentStatsArray.length > 0 ? Math.round(studentStatsArray.reduce((sum, s) => sum + s.attendancePercentage, 0) / studentStatsArray.length) : 0}%
                </div>
                <div className="text-sm text-yellow-700">Avg Attendance</div>
              </div>
            </div>
          </div>
        </div>

        {/* Student Stats Table */}
        <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-neutral-200 bg-neutral-50">
            <h3 className="text-lg font-semibold text-neutral-900">Student Performance Overview</h3>
            <p className="text-sm text-neutral-600 mt-1">Individual student statistics and progress</p>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral-50 border-b border-neutral-200">
                <tr>
                  <th className="text-left py-4 px-6 font-semibold text-neutral-700">Student</th>
                  <th className="text-center py-4 px-4 font-semibold text-neutral-700">Grade Average</th>
                  <th className="text-center py-4 px-4 font-semibold text-neutral-700">Attendance</th>
                  <th className="text-center py-4 px-4 font-semibold text-neutral-700">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {studentStatsArray.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="text-center py-12 text-neutral-500">
                      <div className="flex flex-col items-center gap-3">
                        <svg className="w-12 h-12 text-neutral-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                        </svg>
                        <p>No student data available</p>
                        <p className="text-sm">Student statistics will appear here once data is loaded</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  studentStatsArray.map((student, index) => {
                    const getStatusColor = (gradePercentage, attendancePercentage) => {
                      if (gradePercentage >= 80 && attendancePercentage >= 80) return 'text-green-600 bg-green-50';
                      if (gradePercentage >= 60 && attendancePercentage >= 60) return 'text-yellow-600 bg-yellow-50';
                      return 'text-red-600 bg-red-50';
                    };

                    const getStatusText = (gradePercentage, attendancePercentage) => {
                      if (gradePercentage >= 80 && attendancePercentage >= 80) return 'Excellent';
                      if (gradePercentage >= 60 && attendancePercentage >= 60) return 'Good';
                      return 'Needs Attention';
                    };

                    return (
                      <tr key={index} className="hover:bg-neutral-50 transition-colors duration-150">
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-xl flex items-center justify-center shadow-sm">
                              <span className="text-white font-bold text-sm">
                                {student.name?.charAt(0)}
                              </span>
                            </div>
                            <div>
                              <div className="font-semibold text-neutral-900">{student.name}</div>
                              <div className="text-sm text-neutral-500">@{student.username}</div>
                            </div>
                          </div>
                        </td>
                        
                        <td className="py-4 px-4 text-center">
                          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${
                            student.gradePercentage >= 80 ? 'text-green-700 bg-green-100' :
                            student.gradePercentage >= 60 ? 'text-yellow-700 bg-yellow-100' :
                            'text-red-700 bg-red-100'
                          }`}>
                            <span>{student.gradePercentage}%</span>
                            <span className="text-xs opacity-75">({student.totalScore}/{student.maxPossible})</span>
                          </div>
                        </td>
                        
                        <td className="py-4 px-4 text-center">
                          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${
                            student.attendancePercentage >= 80 ? 'text-green-700 bg-green-100' :
                            student.attendancePercentage >= 60 ? 'text-yellow-700 bg-yellow-100' :
                            'text-red-700 bg-red-100'
                          }`}>
                            <span>{student.attendancePercentage}%</span>
                            <div className="flex gap-1 text-xs">
                              <span className="text-green-600">P:{student.attendanceStats.present}</span>
                              <span className="text-blue-600">E:{student.attendanceStats.excused}</span>
                              <span className="text-yellow-600">L:{student.attendanceStats.late}</span>
                              <span className="text-red-600">A:{student.attendanceStats.absent}</span>
                            </div>
                          </div>
                        </td>
                        
                        <td className="py-4 px-4 text-center">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(student.gradePercentage, student.attendancePercentage)}`}>
                            {getStatusText(student.gradePercentage, student.attendancePercentage)}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const tabs = [
    { id: 'summary', label: 'Summary', icon: '📈' },
    { id: 'announcements', label: 'Updates', icon: '📢' },
    { id: 'assignments', label: 'Assignments', icon: '📝' },
    { id: 'grades', label: 'Grades', icon: '📊' },
    { id: 'attendance', label: 'Attendance', icon: '📅' },
    { id: 'students', label: 'Students', icon: '👥' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-secondary-50 to-neutral-50">
      {/* Modern Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-neutral-200 sticky top-0 z-30">
        <div className="container-mobile py-6">
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={() => navigate(`/level/${levelCode}`)}
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
                {classData?.name || `Level ${levelCode}`}
              </h1>
              <p className="text-neutral-600 mt-1">Teacher Dashboard • {classData?.period || 'Period'}</p>
            </div>
          </div>

          {/* Modern Tab Navigation */}
          <div className="flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                  activeTab === tab.id
                    ? 'bg-primary-600 text-white shadow-lg'
                    : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
                }`}
              >
                <span className="text-base">{tab.icon}</span>
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container-mobile py-6">
        <div className="bg-white rounded-3xl border border-neutral-200 p-6 sm:p-8">
          {activeTab === 'summary' && renderSummaryTab()}
          {activeTab === 'announcements' && <AnnouncementsTab levelCode={levelCode} teacherId={userData.id} />}
          {activeTab === 'assignments' && <AssignmentsTab levelCode={levelCode} teacherId={userData.id} />}
          {activeTab === 'grades' && <GradesTab levelCode={levelCode} teacherId={userData.id} />}
          {activeTab === 'attendance' && <AttendanceTab levelCode={levelCode} teacherId={userData.id} />}
          {activeTab === 'students' && renderStudentsTab()}
        </div>
      </main>

      {/* Add Student Modal */}
      <AddStudentModal
        isOpen={showAddStudentModal}
        onClose={() => setShowAddStudentModal(false)}
        levelCode={levelCode}
        onStudentAdded={handleStudentAdded}
      />
    </div>
  );
}
