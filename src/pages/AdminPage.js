import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [classes, setClasses] = useState([]);
  const [classStats, setClassStats] = useState({});
  const [selectedClass, setSelectedClass] = useState(null);
  const [students, setStudents] = useState([]);
  const [studentStats, setStudentStats] = useState({});
  const [allStudents, setAllStudents] = useState([]);
  const [allParents, setAllParents] = useState([]);
  const [viewMode, setViewMode] = useState('overview'); // 'overview' or 'students'
  const [activeTab, setActiveTab] = useState('classes'); // 'classes', 'students', 'parents'
  const [showStudentSummary, setShowStudentSummary] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingStudent, setEditingStudent] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editData, setEditData] = useState({});
  const [userData, setUserData] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Check user authentication and role
    const authData = sessionStorage.getItem('user_auth');
    if (!authData) {
      setError('Please log in to access this page');
      setLoading(false);
      return;
    }

    const { user } = JSON.parse(authData);
    setUserData(user);

    // Check if user is admin
    if (user.role !== 'admin') {
      setError('Access Denied. Only administrators can access this page.');
      setLoading(false);
      return;
    }

    // If user is admin, fetch data
    fetchAllClasses();
    fetchAllStudents();
    fetchAllParents();
  }, []);

  const fetchAllStudents = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select(`
          id,
          name,
          username,
          email,
          code,
          phone_number,
          date_of_birth,
          created_at,
          updated_at
        `)
        .eq('role', 'student')
        .order('name', { ascending: true });

      if (error) {
        console.error('Supabase error fetching students:', error);
        throw error;
      }
      
      setAllStudents(data || []);
    } catch (err) {
      console.error('Error fetching students:', err);
      setError(`Failed to fetch students: ${err.message}`);
    }
  };

  const fetchAllParents = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select(`
          id,
          name,
          username,
          email,
          phone_number,
          created_at,
          updated_at
        `)
        .eq('role', 'parent')
        .order('name', { ascending: true });

      if (error) throw error;
      setAllParents(data || []);
    } catch (err) {
      console.error('Error fetching parents:', err);
    }
  };

  const fetchAllClasses = async () => {
    try {
      setLoading(true);
      
      // Fetch all levels/classes
      const { data: levelsData, error: levelsError } = await supabase
        .from('levels')
        .select('*')
        .order('name', { ascending: true });

      if (levelsError) throw levelsError;

      // Fetch stats for each class
      const statsPromises = levelsData.map(async (level) => {
        const stats = await fetchClassStats(level.code);
        return { ...level, stats };
      });

      const classesWithStats = await Promise.all(statsPromises);
      setClasses(classesWithStats);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchStudentsForClass = async (levelCode) => {
    try {
      // Fetch students enrolled in this class
      const { data: studentsData, error: studentsError } = await supabase
        .from('student_enrollment')
        .select(`
          student:users (
            id,
            name,
            username,
            email,
            code
          )
        `)
        .eq('level_code', levelCode);

      if (studentsError) throw studentsError;

      const studentsList = studentsData.map(item => item.student);
      // Sort students by name alphabetically
      const sortedStudents = studentsList.sort((a, b) => 
        (a.name || '').localeCompare(b.name || '')
      );
      setStudents(sortedStudents);

      // Fetch individual student stats
      const statsPromises = sortedStudents.map(async (student) => {
        const stats = await fetchStudentStats(student.id, levelCode);
        return { studentId: student.id, stats };
      });

      const studentStatsData = await Promise.all(statsPromises);
      const statsObject = {};
      studentStatsData.forEach(({ studentId, stats }) => {
        statsObject[studentId] = stats;
      });
      setStudentStats(statsObject);
    } catch (err) {
      console.error(`Error fetching students for ${levelCode}:`, err);
      setError(err.message);
    }
  };

  const fetchStudentStats = async (studentId, levelCode) => {
    try {
      // Fetch student grades
      const { data: gradesData, error: gradesError } = await supabase
        .from('grades')
        .select(`
          score,
          assignment:assignments!inner(max_score, level_code)
        `)
        .eq('student_id', studentId)
        .eq('assignment.level_code', levelCode);

      if (gradesError) throw gradesError;

      // Calculate grade average
      let gradeAverage = 0;
      if (gradesData.length > 0) {
        const totalScore = gradesData.reduce((sum, grade) => sum + grade.score, 0);
        const maxPossible = gradesData.reduce((sum, grade) => sum + grade.assignment.max_score, 0);
        gradeAverage = maxPossible > 0 ? Math.round((totalScore / maxPossible) * 100) : 0;
      }

      // Fetch student attendance
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance')
        .select('status')
        .eq('student_id', studentId)
        .eq('level_code', levelCode);

      if (attendanceError) throw attendanceError;

      // Calculate attendance stats
      const attendanceStats = {
        present: 0,
        absent: 0,
        late: 0,
        excused: 0,
        total: attendanceData.length
      };

      attendanceData.forEach(record => {
        if (record.status) {
          attendanceStats[record.status] = (attendanceStats[record.status] || 0) + 1;
        }
      });

      // Calculate attendance percentage
      const weightedAttendance = attendanceStats.present + attendanceStats.excused + (attendanceStats.late * 0.5);
      const attendancePercentage = attendanceStats.total > 0 ? Math.round((weightedAttendance / attendanceStats.total) * 100) : 0;

      return {
        gradeAverage,
        attendanceStats,
        attendancePercentage,
        totalGrades: gradesData.length,
        totalAttendance: attendanceData.length
      };
    } catch (err) {
      console.error(`Error fetching stats for student ${studentId}:`, err);
      return {
        gradeAverage: 0,
        attendanceStats: { present: 0, absent: 0, late: 0, excused: 0, total: 0 },
        attendancePercentage: 0,
        totalGrades: 0,
        totalAttendance: 0
      };
    }
  };

  const fetchClassStats = async (levelCode) => {
    try {
      // Fetch student count
      const { data: studentsData, error: studentsError } = await supabase
        .from('student_enrollment')
        .select('student_id')
        .eq('level_code', levelCode);

      if (studentsError) throw studentsError;
      const studentCount = studentsData.length;

      // Fetch assignment count
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('assignments')
        .select('id, max_score')
        .eq('level_code', levelCode);

      if (assignmentsError) throw assignmentsError;
      const assignmentCount = assignmentsData.length;

      // Fetch grades for average calculation
      const { data: gradesData, error: gradesError } = await supabase
        .from('grades')
        .select(`
          score,
          assignment:assignments!inner(max_score, level_code)
        `)
        .eq('assignment.level_code', levelCode);

      if (gradesError) throw gradesError;

      // Calculate class average
      let classAverage = 0;
      if (gradesData.length > 0) {
        const totalScore = gradesData.reduce((sum, grade) => sum + grade.score, 0);
        const maxPossible = gradesData.reduce((sum, grade) => sum + grade.assignment.max_score, 0);
        classAverage = maxPossible > 0 ? Math.round((totalScore / maxPossible) * 100) : 0;
      }

      // Fetch attendance data
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance')
        .select('status')
        .eq('level_code', levelCode);

      if (attendanceError) throw attendanceError;

      // Calculate attendance stats
      const attendanceStats = {
        present: 0,
        absent: 0,
        late: 0,
        excused: 0,
        total: attendanceData.length
      };

      attendanceData.forEach(record => {
        if (record.status) {
          attendanceStats[record.status] = (attendanceStats[record.status] || 0) + 1;
        }
      });

      // Calculate attendance percentage (present + excused = full, late = 0.5)
      const weightedAttendance = attendanceStats.present + attendanceStats.excused + (attendanceStats.late * 0.5);
      const attendancePercentage = attendanceStats.total > 0 ? Math.round((weightedAttendance / attendanceStats.total) * 100) : 0;

      return {
        studentCount,
        assignmentCount,
        classAverage,
        attendanceStats,
        attendancePercentage,
        totalGrades: gradesData.length
      };
    } catch (err) {
      console.error(`Error fetching stats for ${levelCode}:`, err);
      return {
        studentCount: 0,
        assignmentCount: 0,
        classAverage: 0,
        attendanceStats: { present: 0, absent: 0, late: 0, excused: 0, total: 0 },
        attendancePercentage: 0,
        totalGrades: 0
      };
    }
  };

  const getClassAverageColor = (average) => {
    if (average >= 90) return 'text-green-600 bg-green-50 border-green-200';
    if (average >= 70) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  const getAttendanceColor = (percentage) => {
    if (percentage >= 90) return 'text-green-600 bg-green-50 border-green-200';
    if (percentage >= 70) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  const handleClassSelect = async (classItem) => {
    setSelectedClass(classItem);
    setShowStudentSummary(true);
    setLoading(true);
    try {
      await fetchStudentsForClass(classItem.code);
    } finally {
      setLoading(false);
    }
  };

  const handleBackToOverview = () => {
    setShowStudentSummary(false);
    setSelectedClass(null);
    setStudents([]);
    setStudentStats({});
  };

  const getStudentEnrollments = async (studentId) => {
    try {
      const { data, error } = await supabase
        .from('student_enrollment')
        .select(`
          level_code,
          level:levels(name, code)
        `)
        .eq('student_id', studentId);

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('Error fetching student enrollments:', err);
      return [];
    }
  };

  const handleStudentUpdate = async (updatedData) => {
    setIsSubmitting(true);
    try {
      // Clean the data - convert empty strings to null for date fields
      const cleanedData = {
        ...updatedData,
        date_of_birth: updatedData.date_of_birth || null,
        phone_number: updatedData.phone_number || null,
        code: updatedData.code || null
      };

      const { error } = await supabase
        .from('users')
        .update(cleanedData)
        .eq('id', editingStudent.id);

      if (error) throw error;
      await fetchAllStudents();
      setShowEditModal(false);
      setEditingStudent(null);
      setEditData({});
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditModal = (student) => {
    setEditingStudent(student);
    setEditData({
      name: student.name || '',
      username: student.username || '',
      email: student.email || '',
      code: student.code || '',
      phone_number: student.phone_number || '',
      date_of_birth: student.date_of_birth ? student.date_of_birth.split('T')[0] : '' // Format date for input
    });
    setShowEditModal(true);
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setEditingStudent(null);
    setEditData({});
  };

  const filteredStudents = allStudents.filter(student =>
    student.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.code?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredParents = allParents.filter(parent =>
    parent.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    parent.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    parent.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-neutral-600">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-neutral-900 mb-2">
            {error.includes('Access Denied') ? 'Access Denied' : 'Error Loading Dashboard'}
          </h3>
          <p className="text-neutral-500 mb-6">{error}</p>
          <div className="flex gap-3 justify-center">
            <button 
              onClick={() => navigate('/')} 
              className="btn-primary"
            >
              Go to Home
            </button>
            {!error.includes('Access Denied') && (
              <button
                onClick={() => window.location.reload()}
                className="btn-secondary"
              >
                Try Again
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100">
      {/* Header */}
      <div className="bg-white border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/')}
                className="flex items-center gap-2 text-neutral-600 hover:text-neutral-900 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to Home
              </button>
              <div className="h-6 w-px bg-neutral-300"></div>
              <h1 className="text-xl font-bold text-neutral-900">Admin Dashboard</h1>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-neutral-600">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {activeTab === 'classes' && `${classes.length} Classes`}
                {activeTab === 'students' && `${allStudents.length} Students`}
                {activeTab === 'parents' && `${allParents.length} Parents`}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="bg-white border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            <button
              onClick={() => setActiveTab('classes')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'classes'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                Classes ({classes.length})
              </div>
            </button>
            <button
              onClick={() => setActiveTab('students')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'students'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                </svg>
                Students ({allStudents.length})
              </div>
            </button>
            <button
              onClick={() => setActiveTab('parents')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'parents'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Parents ({allParents.length})
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'classes' && (
          <>

        {/* Classes Table */}
        <h2 className="text-xl font-bold text-neutral-900 mb-6">All Classes</h2>
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral-50 border-b border-neutral-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Class</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-neutral-500 uppercase tracking-wider">Students</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-neutral-500 uppercase tracking-wider">Assignments</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-neutral-500 uppercase tracking-wider">Class Average</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-neutral-500 uppercase tracking-wider">Attendance</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-neutral-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-neutral-200">
                {classes.map((classItem) => (
                  <tr key={classItem.code} className="hover:bg-neutral-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-neutral-900">{classItem.name}</div>
                        <div className="text-sm text-neutral-500">Code: {classItem.code}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="text-sm font-medium text-neutral-900">{classItem.stats.studentCount}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="text-sm font-medium text-neutral-900">{classItem.stats.assignmentCount}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${getClassAverageColor(classItem.stats.classAverage)}`}>
                        {classItem.stats.classAverage}%
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${getAttendanceColor(classItem.stats.attendancePercentage)}`}>
                        {classItem.stats.attendancePercentage}%
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleClassSelect(classItem)}
                          className="btn-secondary px-3 py-1 text-xs"
                        >
                          View Students
                        </button>
                        <button
                          onClick={() => navigate(`/level/${classItem.code}/update`)}
                          className="btn-primary px-3 py-1 text-xs"
                        >
                          View Class
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Empty State */}
        {classes.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-neutral-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-neutral-900 mb-2">No Classes Found</h3>
            <p className="text-neutral-500">There are no classes to display in the admin dashboard.</p>
          </div>
        )}
          </>
        )}

        {activeTab === 'students' && (
          <div>
            {/* Search Bar */}
            <div className="mb-6">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Search students by name, username, email, or code..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="input pl-10 w-full max-w-md"
                />
              </div>
            </div>

            {/* Students Table */}
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-neutral-50 border-b border-neutral-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Student</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Contact</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Classes</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-neutral-200">
                    {filteredStudents.map((student) => (
                      <StudentRow 
                        key={student.id} 
                        student={student} 
                        onEdit={openEditModal}
                        getStudentEnrollments={getStudentEnrollments}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Empty State */}
            {filteredStudents.length === 0 && (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-neutral-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-neutral-900 mb-2">No Students Found</h3>
                <p className="text-neutral-500">
                  {searchTerm ? 'No students match your search criteria.' : 'There are no students in the system.'}
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'parents' && (
          <div>
            {/* Search Bar */}
            <div className="mb-6">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Search parents by name, username, or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="input pl-10 w-full max-w-md"
                />
              </div>
            </div>

            {/* Parents Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredParents.map((parent) => (
                <div key={parent.id} className="card p-6 hover:shadow-lg transition-shadow duration-200">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center">
                      <span className="text-white font-bold text-lg">
                        {parent.name?.charAt(0)?.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-bold text-neutral-900 truncate">{parent.name}</h3>
                      <p className="text-sm text-neutral-500">@{parent.username}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-neutral-600">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      <span className="truncate">{parent.email}</span>
                    </div>
                    {parent.phone_number && (
                      <div className="flex items-center gap-2 text-sm text-neutral-600">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                        <span>{parent.phone_number}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-xs text-neutral-400">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Joined {new Date(parent.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Empty State */}
            {filteredParents.length === 0 && (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-neutral-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-neutral-900 mb-2">No Parents Found</h3>
                <p className="text-neutral-500">
                  {searchTerm ? 'No parents match your search criteria.' : 'There are no parents in the system.'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Student Summary Modal */}
        {showStudentSummary && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-xl font-bold text-neutral-900">{selectedClass?.name} - Student Summary</h3>
                    <p className="text-sm text-neutral-500">Class Code: {selectedClass?.code}</p>
                  </div>
                  <button
                    onClick={handleBackToOverview}
                    className="text-neutral-400 hover:text-neutral-600 transition-colors"
                  >
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {loading ? (
                  <div className="text-center py-8">
                    <div className="w-8 h-8 loading-spinner mx-auto mb-4"></div>
                    <p className="text-neutral-600">Loading student data...</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-neutral-50 border-b border-neutral-200">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Student</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-neutral-500 uppercase tracking-wider">Grade Average</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-neutral-500 uppercase tracking-wider">Attendance</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-neutral-500 uppercase tracking-wider">Present</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-neutral-500 uppercase tracking-wider">Excused</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-neutral-500 uppercase tracking-wider">Late</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-neutral-500 uppercase tracking-wider">Absent</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-neutral-500 uppercase tracking-wider">Total Days</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-neutral-200">
                        {students.map((student) => {
                          const stats = studentStats[student.id] || {};
                          return (
                            <tr key={student.id} className="hover:bg-neutral-50">
                              <td className="px-4 py-3 whitespace-nowrap">
                                <div className="flex items-center">
                                  <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-full flex items-center justify-center">
                                    <span className="text-white font-semibold text-xs">
                                      {student.name?.charAt(0)?.toUpperCase()}
                                    </span>
                                  </div>
                                  <div className="ml-3">
                                    <div className="text-sm font-medium text-neutral-900">{student.name}</div>
                                    <div className="text-xs text-neutral-500">@{student.username}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-center">
                                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${getClassAverageColor(stats.gradeAverage || 0)}`}>
                                  {stats.gradeAverage || 0}%
                                </span>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-center">
                                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${getAttendanceColor(stats.attendancePercentage || 0)}`}>
                                  {stats.attendancePercentage || 0}%
                                </span>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-center">
                                <span className="text-sm font-medium text-green-700">{stats.attendanceStats?.present || 0}</span>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-center">
                                <span className="text-sm font-medium text-blue-700">{stats.attendanceStats?.excused || 0}</span>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-center">
                                <span className="text-sm font-medium text-yellow-700">{stats.attendanceStats?.late || 0}</span>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-center">
                                <span className="text-sm font-medium text-red-700">{stats.attendanceStats?.absent || 0}</span>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-center">
                                <span className="text-sm font-medium text-neutral-900">{stats.totalAttendance || 0}</span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {students.length === 0 && !loading && (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-neutral-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-bold text-neutral-900 mb-2">No Students Found</h3>
                    <p className="text-neutral-500">There are no students enrolled in this class.</p>
                  </div>
                )}

                <div className="flex justify-end mt-6">
                  <button
                    onClick={handleBackToOverview}
                    className="btn-secondary px-4 py-2"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Edit Student Modal */}
        {showEditModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-neutral-900">Edit Student</h3>
                  <button
                    onClick={closeEditModal}
                    className="text-neutral-400 hover:text-neutral-600 transition-colors"
                  >
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <form onSubmit={(e) => {
                  e.preventDefault();
                  handleStudentUpdate(editData);
                }} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={editData.name}
                      onChange={(e) => setEditData({...editData, name: e.target.value})}
                      className="input w-full"
                      placeholder="Enter student's full name"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      Username
                    </label>
                    <input
                      type="text"
                      value={editData.username}
                      onChange={(e) => setEditData({...editData, username: e.target.value})}
                      className="input w-full"
                      placeholder="Enter username"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      value={editData.email}
                      onChange={(e) => setEditData({...editData, email: e.target.value})}
                      className="input w-full"
                      placeholder="Enter email address"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      Student Code
                    </label>
                    <input
                      type="text"
                      value={editData.code}
                      onChange={(e) => setEditData({...editData, code: e.target.value})}
                      className="input w-full"
                      placeholder="Enter student code"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={editData.phone_number}
                      onChange={(e) => setEditData({...editData, phone_number: e.target.value})}
                      className="input w-full"
                      placeholder="Enter phone number"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      Date of Birth
                    </label>
                    <input
                      type="date"
                      value={editData.date_of_birth}
                      onChange={(e) => setEditData({...editData, date_of_birth: e.target.value})}
                      className="input w-full"
                    />
                  </div>

                  <div className="flex items-center gap-3 pt-4">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="btn-primary flex-1"
                    >
                      {isSubmitting ? 'Saving...' : 'Save Changes'}
                    </button>
                    <button
                      type="button"
                      onClick={closeEditModal}
                      className="btn-secondary flex-1"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Student Row Component
function StudentRow({ student, onEdit, getStudentEnrollments }) {
  const [enrollments, setEnrollments] = useState([]);
  const [loadingEnrollments, setLoadingEnrollments] = useState(false);
  const [showEnrollments, setShowEnrollments] = useState(false);

  const fetchEnrollments = async () => {
    if (showEnrollments && enrollments.length === 0) {
      setLoadingEnrollments(true);
      try {
        const data = await getStudentEnrollments(student.id);
        setEnrollments(data);
      } catch (err) {
        console.error('Error fetching enrollments:', err);
      } finally {
        setLoadingEnrollments(false);
      }
    }
  };

  useEffect(() => {
    fetchEnrollments();
  }, [showEnrollments]);

  return (
    <tr className="hover:bg-neutral-50">
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center">
          <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-full flex items-center justify-center">
            <span className="text-white font-semibold text-sm">
              {student.name?.charAt(0)?.toUpperCase()}
            </span>
          </div>
          <div className="ml-4">
            <div className="text-sm font-medium text-neutral-900">{student.name}</div>
            <div className="text-sm text-neutral-500">@{student.username}</div>
          </div>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm text-neutral-900">
          <div>{student.email}</div>
          {student.phone_number && (
            <div className="text-neutral-500">{student.phone_number}</div>
          )}
        </div>
      </td>
      <td className="px-6 py-4">
        <div className="text-sm text-neutral-500">
          {student.code && <div>Code: {student.code}</div>}
          {student.date_of_birth && (
            <div>DOB: {new Date(student.date_of_birth).toLocaleDateString()}</div>
          )}
          <button
            onClick={() => setShowEnrollments(!showEnrollments)}
            className="text-xs text-primary-600 hover:text-primary-800 mt-1"
          >
            {showEnrollments ? 'Hide' : 'Show'} Classes
          </button>
          {showEnrollments && (
            <div className="mt-2 space-y-1">
              {loadingEnrollments ? (
                <div className="text-xs text-neutral-400">Loading...</div>
              ) : (
                <>
                  {enrollments.map((enrollment) => (
                    <div key={enrollment.level_code} className="text-xs bg-neutral-100 px-2 py-1 rounded">
                      {enrollment.level?.name} ({enrollment.level_code})
                    </div>
                  ))}
                  {enrollments.length === 0 && (
                    <div className="text-xs text-neutral-400">No classes enrolled</div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
        <button
          onClick={() => onEdit(student)}
          className="btn-secondary px-3 py-1 text-xs hover:bg-primary-50 hover:text-primary-700 transition-colors"
        >
          Edit
        </button>
      </td>
    </tr>
  );
}
