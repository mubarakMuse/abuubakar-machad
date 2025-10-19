import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function StudentReportCard({ student }) {
  const [enrollments, setEnrollments] = useState([]);
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [grades, setGrades] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (student) {
      fetchStudentData();
    }
  }, [student]);

  const fetchStudentData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch student enrollments
      const { data: enrollmentData, error: enrollmentError } = await supabase
        .from('student_enrollment')
        .select(`
          level_code,
          enrolled_at,
          level:levels(name, code)
        `)
        .eq('student_id', student.id)
        .order('enrolled_at', { ascending: false });

      if (enrollmentError) throw enrollmentError;

      setEnrollments(enrollmentData || []);

      // If there are enrollments, select the most recent one by default
      if (enrollmentData && enrollmentData.length > 0) {
        setSelectedLevel(enrollmentData[0]);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedLevel && student) {
      fetchLevelData();
    }
  }, [selectedLevel, student]);

  const fetchLevelData = async () => {
    try {
      setLoading(true);

      // Fetch grades for the selected level
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
            due_date,
            category:grade_categories (
              name
            )
          )
        `)
        .eq('student_id', student.id)
        .eq('assignment.level_code', selectedLevel.level_code)
        .order('graded_at', { ascending: false });

      if (gradesError) throw gradesError;

      setGrades(gradesData || []);

      // Fetch attendance for the selected level
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance')
        .select('*')
        .eq('student_id', student.id)
        .eq('level_code', selectedLevel.level_code)
        .order('date', { ascending: false });

      if (attendanceError) throw attendanceError;

      setAttendance(attendanceData || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const calculateLetterGrade = (percentage) => {
    if (percentage >= 93) return 'A';
    if (percentage >= 90) return 'A-';
    if (percentage >= 87) return 'B+';
    if (percentage >= 83) return 'B';
    if (percentage >= 80) return 'B-';
    if (percentage >= 77) return 'C+';
    if (percentage >= 73) return 'C';
    if (percentage >= 70) return 'C-';
    if (percentage >= 67) return 'D+';
    if (percentage >= 63) return 'D';
    if (percentage >= 60) return 'D-';
    return 'F';
  };

  const calculateOverallAverage = () => {
    if (grades.length === 0) return null;

    const totalPercentage = grades.reduce((sum, grade) => {
      const percentage = grade.assignment?.max_score > 0 
        ? (grade.score / grade.assignment.max_score) * 100 
        : 0;
      return sum + percentage;
    }, 0);

    return (totalPercentage / grades.length).toFixed(1);
  };

  const calculateAttendancePercentage = () => {
    if (attendance.length === 0) return null;

    const presentCount = attendance.filter(record => record.status === 'present').length;
    return ((presentCount / attendance.length) * 100).toFixed(1);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
        <p className="text-red-700">{error}</p>
      </div>
    );
  }

  const overallAverage = calculateOverallAverage();
  const attendancePercentage = calculateAttendancePercentage();

  return (
    <div className="space-y-6">
      {/* Student Information */}
      <div className="bg-gray-50 rounded-lg p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Student Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-medium text-gray-500">Name</p>
            <p className="text-lg text-gray-900">{student.name}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Student ID</p>
            <p className="text-lg text-gray-900">{student.code || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Email</p>
            <p className="text-lg text-gray-900">{student.email || 'N/A'}</p>
          </div>
          {student.date_of_birth && (
            <div>
              <p className="text-sm font-medium text-gray-500">Date of Birth</p>
              <p className="text-lg text-gray-900">
                {new Date(student.date_of_birth).toLocaleDateString()}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Level Selection */}
      {enrollments.length > 0 && (
        <div className="bg-white border rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Class</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {enrollments.map((enrollment) => (
              <button
                key={enrollment.level_code}
                onClick={() => setSelectedLevel(enrollment)}
                className={`p-4 border rounded-lg text-left transition-colors ${
                  selectedLevel?.level_code === enrollment.level_code
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <h4 className="font-medium text-gray-900">
                  {enrollment.level?.name || enrollment.level_code}
                </h4>
                <p className="text-sm text-gray-600">
                  Enrolled: {new Date(enrollment.enrolled_at).toLocaleDateString()}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {selectedLevel && (
        <>
          {/* Overall Performance Summary */}
          <div className="bg-white border rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Summary</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-indigo-600">
                  {overallAverage ? `${overallAverage}%` : 'N/A'}
                </div>
                <div className="text-sm text-gray-600">Overall Average</div>
                {overallAverage && (
                  <div className="text-sm font-medium text-gray-900">
                    Grade: {calculateLetterGrade(parseFloat(overallAverage))}
                  </div>
                )}
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">
                  {attendancePercentage ? `${attendancePercentage}%` : 'N/A'}
                </div>
                <div className="text-sm text-gray-600">Attendance</div>
                <div className="text-sm text-gray-900">
                  {attendance.length} class{attendance.length !== 1 ? 'es' : ''} recorded
                </div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600">
                  {grades.length}
                </div>
                <div className="text-sm text-gray-600">Assignments</div>
                <div className="text-sm text-gray-900">Graded</div>
              </div>
            </div>
          </div>

          {/* Grades */}
          <div className="bg-white border rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Assignment Grades</h3>
            {grades.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Assignment
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Category
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Score
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Grade
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {grades.map((grade) => {
                      const percentage = grade.assignment?.max_score > 0 
                        ? (grade.score / grade.assignment.max_score) * 100 
                        : 0;
                      const letterGrade = calculateLetterGrade(percentage);
                      
                      return (
                        <tr key={grade.id}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {grade.assignment?.title || 'N/A'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {grade.assignment?.category?.name || 'N/A'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {grade.score} / {grade.assignment?.max_score || 'N/A'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              percentage >= 90 ? 'bg-green-100 text-green-800' :
                              percentage >= 80 ? 'bg-blue-100 text-blue-800' :
                              percentage >= 70 ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {letterGrade} ({percentage.toFixed(1)}%)
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {new Date(grade.graded_at).toLocaleDateString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">No grades available for this class.</p>
            )}
          </div>

          {/* Attendance */}
          <div className="bg-white border rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Attendance Record</h3>
            {attendance.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Notes
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {attendance.map((record) => (
                      <tr key={record.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(record.date).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            record.status === 'present' 
                              ? 'bg-green-100 text-green-800'
                              : record.status === 'late'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {record.status?.charAt(0).toUpperCase() + record.status?.slice(1) || 'N/A'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {record.notes || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">No attendance records available for this class.</p>
            )}
          </div>
        </>
      )}

      {enrollments.length === 0 && (
        <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded">
          <p className="text-yellow-700">No class enrollments found for this student.</p>
        </div>
      )}
    </div>
  );
}
