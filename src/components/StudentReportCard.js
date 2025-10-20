import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function StudentReportCard({ student }) {
  const [enrollments, setEnrollments] = useState([]);
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [grades, setGrades] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [allGradesByLevel, setAllGradesByLevel] = useState({});
  const [allAttendanceByLevel, setAllAttendanceByLevel] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('summary'); // 'summary' or 'details'

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

      // If there are enrollments, fetch all grades and attendance for all levels
      if (enrollmentData && enrollmentData.length > 0) {
        // Set the latest level as default (first in the sorted array)
        setSelectedLevel(enrollmentData[0]);
        await fetchAllLevelData(enrollmentData);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllLevelData = async (enrollments) => {
    try {
      const levelCodes = enrollments.map(e => e.level_code);
      
      // Fetch all grades for all levels
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
        .in('assignment.level_code', levelCodes)
        .order('graded_at', { ascending: false });

      if (gradesError) throw gradesError;

      // Group grades by level
      const gradesByLevel = {};
      gradesData?.forEach(grade => {
        const levelCode = grade.assignment?.level_code;
        if (levelCode) {
          if (!gradesByLevel[levelCode]) {
            gradesByLevel[levelCode] = [];
          }
          gradesByLevel[levelCode].push(grade);
        }
      });
      setAllGradesByLevel(gradesByLevel);

      // Fetch all attendance for all levels
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance')
        .select('*')
        .eq('student_id', student.id)
        .in('level_code', levelCodes)
        .order('date', { ascending: false });

      if (attendanceError) throw attendanceError;

      // Group attendance by level
      const attendanceByLevel = {};
      attendanceData?.forEach(record => {
        const levelCode = record.level_code;
        if (!attendanceByLevel[levelCode]) {
          attendanceByLevel[levelCode] = [];
        }
        attendanceByLevel[levelCode].push(record);
      });
      setAllAttendanceByLevel(attendanceByLevel);

    } catch (err) {
      setError(err.message);
    }
  };

  // Helper function to calculate total points for a specific level
  const calculateLevelPoints = (levelGrades) => {
    if (!levelGrades || levelGrades.length === 0) return { earned: 0, possible: 0 };

    const totals = levelGrades.reduce((acc, grade) => {
      const earned = grade.score || 0;
      const possible = grade.assignment?.max_score || 0;
      return {
        earned: acc.earned + earned,
        possible: acc.possible + possible
      };
    }, { earned: 0, possible: 0 });

    return totals;
  };

  // Helper function to calculate attendance percentage for a specific level
  const calculateLevelAttendancePercentage = (levelAttendance) => {
    if (!levelAttendance || levelAttendance.length === 0) return null;

    const presentCount = levelAttendance.filter(record => record.status === 'present').length;
    return ((presentCount / levelAttendance.length) * 100).toFixed(1);
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

  // Calculate overall statistics across all levels
  const allGrades = Object.values(allGradesByLevel).flat();
  const allAttendance = Object.values(allAttendanceByLevel).flat();
  const overallPoints = allGrades.length > 0 ? calculateLevelPoints(allGrades) : { earned: 0, possible: 0 };
  const attendancePercentage = allAttendance.length > 0 ? calculateLevelAttendancePercentage(allAttendance) : null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="px-4 py-6">
          <h1 className="text-2xl font-bold text-gray-900">{student.name}</h1>
          <p className="text-gray-600 mt-1">Student Report Card</p>
        </div>
      </div>

      {/* Mobile Tabs */}
      <div className="bg-white border-b">
        <div className="flex">
          <button
            onClick={() => setActiveTab('summary')}
            className={`flex-1 py-3 px-4 text-sm font-medium text-center border-b-2 ${
              activeTab === 'summary'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Summary
          </button>
          <button
            onClick={() => setActiveTab('details')}
            className={`flex-1 py-3 px-4 text-sm font-medium text-center border-b-2 ${
              activeTab === 'details'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Details
          </button>
        </div>
      </div>

      <div className="p-4">
        {activeTab === 'summary' ? (
          /* Quick Summary View */
          <div className="space-y-4">
            {enrollments.length > 0 ? (
              enrollments.map((enrollment) => {
                const levelGrades = allGradesByLevel[enrollment.level_code] || [];
                const levelAttendance = allAttendanceByLevel[enrollment.level_code] || [];
                const levelPoints = calculateLevelPoints(levelGrades);
                const levelAttendancePercentage = calculateLevelAttendancePercentage(levelAttendance);
                
                return (
                  <div
                    key={enrollment.level_code}
                    className="bg-white rounded-lg shadow-sm border p-4"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {enrollment.level?.name || enrollment.level_code}
                      </h3>
                      <button
                        onClick={() => {
                          setSelectedLevel(enrollment);
                          setActiveTab('details');
                        }}
                        className="text-indigo-600 text-sm font-medium"
                      >
                        View Details →
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-3 bg-gray-50 rounded-lg">
                        <div className="text-2xl font-bold text-indigo-600">
                          {levelPoints.possible > 0 ? (() => {
                            const percentage = (levelPoints.earned / levelPoints.possible) * 100;
                            return calculateLetterGrade(percentage);
                          })() : 'N/A'}
                        </div>
                        <div className="text-sm text-gray-600">Grade</div>
                        {levelPoints.possible > 0 && (
                          <div className="text-xs text-gray-500 mt-1">
                            {((levelPoints.earned / levelPoints.possible) * 100).toFixed(1)}%
                          </div>
                        )}
                        <div className="text-xs text-gray-400 mt-1">
                          {levelPoints.possible > 0 ? `${levelPoints.earned}/${levelPoints.possible} pts` : 'No points'}
                        </div>
                      </div>
                      
                      <div className="text-center p-3 bg-gray-50 rounded-lg">
                        <div className="text-2xl font-bold text-green-600">
                          {levelAttendancePercentage ? `${levelAttendancePercentage}%` : 'N/A'}
                        </div>
                        <div className="text-sm text-gray-600">Attendance</div>
                        <div className="text-xs text-gray-500 mt-1">
                          {levelAttendance.length} classes
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
                <p className="text-yellow-700">No class enrollments found for this student.</p>
              </div>
            )}
          </div>
        ) : (
          /* Detailed View for Selected Level */
          selectedLevel ? (
            <div className="space-y-6">
              {/* Level Header */}
              <div className="bg-white rounded-lg shadow-sm border p-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-gray-900">
                    {selectedLevel.level?.name || selectedLevel.level_code}
                  </h2>
                  <button
                    onClick={() => setActiveTab('summary')}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    ← Back to Summary
                  </button>
                </div>
                
                {/* Quick Stats */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="text-center p-3 bg-indigo-50 rounded-lg">
                    <div className="text-xl font-bold text-indigo-600">
                      {(() => {
                        const points = calculateLevelPoints(allGradesByLevel[selectedLevel.level_code] || []);
                        if (points.possible > 0) {
                          const percentage = (points.earned / points.possible) * 100;
                          return calculateLetterGrade(percentage);
                        }
                        return 'N/A';
                      })()}
                    </div>
                    <div className="text-sm text-indigo-600">Grade</div>
                    {(() => {
                      const points = calculateLevelPoints(allGradesByLevel[selectedLevel.level_code] || []);
                      return points.possible > 0 ? (
                        <div className="text-xs text-indigo-500 mt-1">
                          {((points.earned / points.possible) * 100).toFixed(1)}%
                        </div>
                      ) : null;
                    })()}
                    <div className="text-xs text-indigo-400 mt-1">
                      {(() => {
                        const points = calculateLevelPoints(allGradesByLevel[selectedLevel.level_code] || []);
                        return points.possible > 0 ? `${points.earned}/${points.possible} pts` : 'No points';
                      })()}
                    </div>
                  </div>
                  
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <div className="text-xl font-bold text-green-600">
                      {calculateLevelAttendancePercentage(allAttendanceByLevel[selectedLevel.level_code] || []) || 'N/A'}%
                    </div>
                    <div className="text-sm text-green-600">Attendance</div>
                  </div>
                </div>
              </div>

              {/* Grades Section */}
              <div className="bg-white rounded-lg shadow-sm border">
                <div className="p-4 border-b">
                  <h3 className="text-lg font-semibold text-gray-900">Grades</h3>
                </div>
                <div className="p-4">
                  {allGradesByLevel[selectedLevel.level_code]?.length > 0 ? (
                    <div className="space-y-3">
                      {allGradesByLevel[selectedLevel.level_code].map((grade) => {
                        const percentage = grade.assignment?.max_score > 0 
                          ? (grade.score / grade.assignment.max_score) * 100 
                          : 0;
                        const letterGrade = calculateLetterGrade(percentage);
                        
                        return (
                          <div key={grade.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div className="flex-1">
                              <div className="font-medium text-gray-900">
                                {grade.assignment?.title || 'N/A'}
                              </div>
                              <div className="text-sm text-gray-600">
                                {grade.score} / {grade.assignment?.max_score || 'N/A'}
                              </div>
                            </div>
                            <div className="text-right">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                percentage >= 90 ? 'bg-green-100 text-green-800' :
                                percentage >= 80 ? 'bg-blue-100 text-blue-800' :
                                percentage >= 70 ? 'bg-yellow-100 text-yellow-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                                {letterGrade} ({percentage.toFixed(1)}%)
                              </span>
                              <div className="text-xs text-gray-500 mt-1">
                                {new Date(grade.graded_at).toLocaleDateString()}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-center py-8">No grades available for this class.</p>
                  )}
                </div>
              </div>

              {/* Attendance Section */}
              <div className="bg-white rounded-lg shadow-sm border">
                <div className="p-4 border-b">
                  <h3 className="text-lg font-semibold text-gray-900">Attendance</h3>
                </div>
                <div className="p-4">
                  {allAttendanceByLevel[selectedLevel.level_code]?.length > 0 ? (
                    <div className="space-y-2">
                      {allAttendanceByLevel[selectedLevel.level_code].map((record) => (
                        <div key={record.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="text-sm font-medium text-gray-900">
                            {new Date(record.date).toLocaleDateString()}
                          </div>
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            record.status === 'present' 
                              ? 'bg-green-100 text-green-800'
                              : record.status === 'late'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {record.status?.charAt(0).toUpperCase() + record.status?.slice(1) || 'N/A'}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-center py-8">No attendance records available for this class.</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
              <p className="text-yellow-700">Please select a class from the summary view.</p>
            </div>
          )
        )}
      </div>
    </div>
  );
}
