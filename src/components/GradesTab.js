import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function GradesTab({ levelCode }) {
  const [grades, setGrades] = useState([]);
  const [error, setError] = useState(null);
  const [editingGrade, setEditingGrade] = useState(null);
  const [showAddGradeModal, setShowAddGradeModal] = useState(false);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' view only
  const [newGrade, setNewGrade] = useState({
    student_id: '',
    assignment_id: '',
    score: '',
    feedback: ''
  });
  const [students, setStudents] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (levelCode) {
      fetchGrades();
      fetchStudents();
      fetchAssignments();
    }
  }, [levelCode]);

  const fetchGrades = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('grades')
        .select(`
          *,
          assignment:assignments!inner(*),
          student:users(name)
        `)
        .eq('assignment.level_code', levelCode)
        .order('graded_at', { ascending: false });

      if (error) throw error;
      setGrades(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchStudents = async () => {
    try {
      const { data, error } = await supabase
        .from('student_enrollment')
        .select('student:users(id, name)')
        .eq('level_code', levelCode);

      if (error) throw error;
      // Sort students alphabetically by name
      const sortedStudents = (data?.map(item => item.student) || []).sort((a, b) => 
        a.name.localeCompare(b.name)
      );
      setStudents(sortedStudents);
    } catch (err) {
      setError(err.message);
    }
  };

  const fetchAssignments = async () => {
    try {
      const { data, error } = await supabase
        .from('assignments')
        .select('*')
        .eq('level_code', levelCode)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAssignments(data);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleGradeUpdate = async (gradeId, newScore, newFeedback) => {
    try {
      const { error } = await supabase
        .from('grades')
        .update({
          score: parseFloat(newScore),
          feedback: newFeedback,
          graded_at: new Date().toISOString()
        })
        .eq('id', gradeId);

      if (error) throw error;
      await fetchGrades();
      setEditingGrade(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAddGrade = async (e) => {
    e.preventDefault();
    try {
      const { error } = await supabase
        .from('grades')
        .insert([{
          ...newGrade,
          score: parseFloat(newGrade.score),
          graded_at: new Date().toISOString()
        }]);

      if (error) throw error;
      await fetchGrades();
      setShowAddGradeModal(false);
      setNewGrade({
        student_id: '',
        assignment_id: '',
        score: '',
        feedback: ''
      });
    } catch (err) {
      setError(err.message);
    }
  };

  // New function to organize grades by assignment
  const getGradesByAssignment = () => {
    const gradesByAssignment = {};
    assignments.forEach(assignment => {
      gradesByAssignment[assignment.id] = {
        assignment,
        grades: grades.filter(grade => grade.assignment_id === assignment.id)
      };
    });
    return gradesByAssignment;
  };

  // New function to organize grades by student
  const getGradesByStudent = () => {
    const gradesByStudent = {};
    students.forEach(student => {
      gradesByStudent[student.id] = {
        student,
        grades: grades.filter(grade => grade.student_id === student.id)
      };
    });
    return gradesByStudent;
  };

  // New function to calculate final grade for a student
  const calculateFinalGrade = (studentGrades) => {
    if (!studentGrades || studentGrades.length === 0) return { totalScore: 0, maxPossible: 0, percentage: 0 };
    
    const totalScore = studentGrades.reduce((sum, grade) => sum + (grade.score || 0), 0);
    const maxPossible = studentGrades.reduce((sum, grade) => sum + (grade.assignment?.max_score || 0), 0);
    const percentage = maxPossible > 0 ? Math.round((totalScore / maxPossible) * 100) : 0;
    
    return { totalScore, maxPossible, percentage };
  };

  // Get grade for a specific student-assignment combination
  const getGradeForStudentAssignment = (studentId, assignmentId) => {
    return grades.find(grade => 
      grade.student_id === studentId && grade.assignment_id === assignmentId
    );
  };

  // Handle grade update in grid
  const handleGridGradeUpdate = async (studentId, assignmentId, newScore) => {
    try {
      const existingGrade = getGradeForStudentAssignment(studentId, assignmentId);
      
      if (existingGrade) {
        // Update existing grade
        const { error } = await supabase
          .from('grades')
          .update({
            score: parseFloat(newScore),
            graded_at: new Date().toISOString()
          })
          .eq('id', existingGrade.id);

        if (error) throw error;
      } else {
        // Create new grade
        const { error } = await supabase
          .from('grades')
          .insert([{
            student_id: studentId,
            assignment_id: assignmentId,
            score: parseFloat(newScore),
            graded_at: new Date().toISOString()
          }]);

        if (error) throw error;
      }
      
      await fetchGrades();
    } catch (err) {
      setError(err.message);
    }
  };

  // New function to calculate letter grade
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

  // New function to calculate letter grade for individual assignment
  const calculateAssignmentLetterGrade = (score, maxScore) => {
    if (!score || !maxScore) return '-';
    const percentage = (score / maxScore) * 100;
    return calculateLetterGrade(percentage);
  };

  // Render grid view with students as rows and assignments as columns
  const renderGridView = () => {
    if (assignments.length === 0) {
      return (
        <div className="card p-8 text-center">
          <div className="w-16 h-16 bg-neutral-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-neutral-900 mb-2">No assignments yet</h3>
          <p className="text-neutral-500">Create assignments to start grading students.</p>
        </div>
      );
    }

    return (
      <div className="card p-0 overflow-hidden">
        <div className="p-4 border-b border-neutral-200 bg-neutral-50">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-neutral-900">Grade Grid</h3>
              <p className="text-sm text-neutral-600">Click any cell to edit grades</p>
            </div>
            <div className="flex items-center gap-4 text-sm text-neutral-600">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-100 border border-green-300 rounded"></div>
                <span>90%+</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-yellow-100 border border-yellow-300 rounded"></div>
                <span>70-89%</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-100 border border-red-300 rounded"></div>
                <span>&lt;70%</span>
              </div>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-neutral-200 bg-white">
                <th className="text-left py-4 px-4 font-semibold text-neutral-700 sticky left-0 bg-white z-20 shadow-sm">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                    </svg>
                    Student
                  </div>
                </th>
                {assignments.map((assignment) => (
                  <th key={assignment.id} className="text-center py-4 px-3 font-semibold text-neutral-700 min-w-[140px] bg-neutral-50">
                    <div className="flex flex-col items-center space-y-1">
                      <div className="text-xs text-neutral-500 font-medium">
                        {new Date(assignment.due_date).toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric' 
                        })}
                      </div>
                      <div className="text-sm font-semibold text-neutral-900 truncate max-w-[120px]" title={assignment.title}>
                        {assignment.title}
                      </div>
                      <div className="text-xs text-neutral-400 bg-neutral-200 px-2 py-1 rounded-full">
                        /{assignment.max_score}
                      </div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {students.map((student, index) => {
                const studentGrades = grades.filter(grade => grade.student_id === student.id);
                const { totalScore, maxPossible, percentage } = calculateFinalGrade(studentGrades);
                
                return (
                  <tr key={student.id} className="border-b border-neutral-100 hover:bg-neutral-50 transition-colors duration-150">
                    <td className="py-4 px-4 sticky left-0 bg-white z-10 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-xl flex items-center justify-center shadow-sm">
                          <span className="text-white font-bold text-sm">
                            {student.name?.charAt(0)}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-neutral-900 truncate">{student.name}</div>
                          <div className="text-xs text-neutral-500">
                            {totalScore}/{maxPossible} points
                          </div>
                          <div className={`text-xs font-medium ${
                            percentage >= 90 ? 'text-green-600' :
                            percentage >= 70 ? 'text-yellow-600' :
                            'text-red-600'
                          }`}>
                            {percentage}% average
                          </div>
                        </div>
                      </div>
                    </td>
                    {assignments.map((assignment) => {
                      const grade = getGradeForStudentAssignment(student.id, assignment.id);
                      const isEditing = editingGrade === `${student.id}-${assignment.id}`;
                      
                      const gradePercentage = grade ? Math.round((grade.score / assignment.max_score) * 100) : 0;
                      const gradeColor = gradePercentage >= 90 ? 'bg-green-50 border-green-200 text-green-800' :
                                        gradePercentage >= 70 ? 'bg-yellow-50 border-yellow-200 text-yellow-800' :
                                        gradePercentage > 0 ? 'bg-red-50 border-red-200 text-red-800' :
                                        'bg-neutral-50 border-neutral-200 text-neutral-500';
                      
                      return (
                        <td key={assignment.id} className="py-3 px-2 text-center">
                          {isEditing ? (
                            <div className="relative">
                              <input
                                type="number"
                                defaultValue={grade?.score || ''}
                                className="w-20 input text-center text-sm font-semibold border-2 border-primary-500 focus:ring-2 focus:ring-primary-200"
                                placeholder="0"
                                min="0"
                                max={assignment.max_score}
                                onBlur={(e) => {
                                  if (e.target.value !== '') {
                                    handleGridGradeUpdate(student.id, assignment.id, e.target.value);
                                  }
                                  setEditingGrade(null);
                                }}
                                onKeyPress={(e) => {
                                  if (e.key === 'Enter') {
                                    if (e.target.value !== '') {
                                      handleGridGradeUpdate(student.id, assignment.id, e.target.value);
                                    }
                                    setEditingGrade(null);
                                  } else if (e.key === 'Escape') {
                                    setEditingGrade(null);
                                  }
                                }}
                                autoFocus
                              />
                              <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 text-xs text-neutral-500 whitespace-nowrap">
                                /{assignment.max_score}
                              </div>
                            </div>
                          ) : (
                            <div 
                              className={`cursor-pointer hover:scale-105 transition-all duration-150 rounded-lg border-2 px-3 py-2 min-h-[50px] flex flex-col items-center justify-center ${gradeColor} hover:shadow-sm`}
                              onClick={() => setEditingGrade(`${student.id}-${assignment.id}`)}
                              title={`Click to edit grade for ${student.name} - ${assignment.title}`}
                            >
                              {grade ? (
                                <div className="text-center">
                                  <div className="font-bold text-lg">{grade.score}</div>
                                  <div className="text-xs font-medium opacity-75">
                                    {gradePercentage}%
                                  </div>
                                  <div className="text-xs opacity-60">
                                    /{assignment.max_score}
                                  </div>
                                </div>
                              ) : (
                                <div className="text-center">
                                  <div className="text-lg font-medium opacity-50">-</div>
                                  <div className="text-xs opacity-40">Click to add</div>
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
        {/* Footer with Statistics */}
        <div className="p-4 border-t border-neutral-200 bg-neutral-50">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <span className="text-neutral-600">Students:</span>
                <span className="font-semibold text-neutral-900">{students.length}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-neutral-600">Assignments:</span>
                <span className="font-semibold text-neutral-900">{assignments.length}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-neutral-600">Grades Entered:</span>
                <span className="font-semibold text-neutral-900">{grades.length}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-neutral-600">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Click any cell to edit grades</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderAssignmentView = () => {
    const gradesByAssignment = getGradesByAssignment();
    
    return (
      <div className="space-y-6">
        {assignments.map((assignment, index) => {
          const assignmentGrades = gradesByAssignment[assignment.id]?.grades || [];
          return (
            <div key={assignment.id} className="card p-6 animate-slide-up" style={{ animationDelay: `${index * 100}ms` }}>
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-lg font-bold text-neutral-900">{assignment.title}</h3>
                  <p className="text-sm text-neutral-600">Max Score: {assignment.max_score}</p>
                </div>
                <div className="text-right">
                  <div className="text-sm text-neutral-500">Grades</div>
                  <div className="text-lg font-bold text-primary-600">{assignmentGrades.length}</div>
                </div>
              </div>
              
              {assignmentGrades.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-neutral-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <p className="text-neutral-500">No grades recorded yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {assignmentGrades.map(grade => (
                    <div key={grade.id} className="flex items-center justify-between p-4 bg-neutral-50 rounded-2xl">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                          <span className="text-primary-600 font-semibold text-sm">
                            {grade.student?.name?.charAt(0)}
                          </span>
                        </div>
                        <div>
                          <h4 className="font-semibold text-neutral-900">{grade.student?.name}</h4>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="flex items-center gap-2">
                            {editingGrade === grade.id ? (
                              <input
                                type="number"
                                defaultValue={grade.score}
                                className="w-20 input text-center"
                                onBlur={(e) => handleGradeUpdate(grade.id, e.target.value, grade.feedback)}
                              />
                            ) : (
                              <span className="text-lg font-bold text-neutral-900">{grade.score}</span>
                            )}
                            <span className="text-sm text-neutral-500">/ {grade.assignment?.max_score}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            {editingGrade === grade.id ? (
                              <span className="text-neutral-400">-</span>
                            ) : (
                              <span className={`badge ${
                                calculateAssignmentLetterGrade(grade.score, grade.assignment?.max_score) === 'A' ? 'badge-success' :
                                calculateAssignmentLetterGrade(grade.score, grade.assignment?.max_score) === 'B' ? 'badge-primary' :
                                calculateAssignmentLetterGrade(grade.score, grade.assignment?.max_score) === 'C' ? 'badge-warning' :
                                'badge-error'
                              }`}>
                                {calculateAssignmentLetterGrade(grade.score, grade.assignment?.max_score)}
                              </span>
                            )}
                          </div>
                        </div>
                        
                        <button
                          onClick={() => setEditingGrade(editingGrade === grade.id ? null : grade.id)}
                          className="btn-ghost text-sm px-3 py-2"
                        >
                          {editingGrade === grade.id ? 'Save' : 'Edit'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderStudentView = () => {
    const gradesByStudent = getGradesByStudent();
    
    return (
      <div className="space-y-6">
        {students.map((student, index) => {
          const studentGrades = gradesByStudent[student.id]?.grades || [];
          const { totalScore, maxPossible, percentage } = calculateFinalGrade(studentGrades);
          const finalLetterGrade = calculateLetterGrade(percentage);
          
          // Find assignments that don't have grades for this student
          const missingAssignments = assignments.filter(assignment => 
            !studentGrades.some(grade => grade.assignment_id === assignment.id)
          );
          
          return (
            <div key={student.id} className="card p-6 animate-slide-up" style={{ animationDelay: `${index * 100}ms` }}>
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-2xl flex items-center justify-center">
                    <span className="text-white font-bold text-lg">
                      {student.name?.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-neutral-900">{student.name}</h3>
                    <p className="text-sm text-neutral-600">{studentGrades.length} assignments graded</p>
                  </div>
                </div>
                
                <div className="text-right">
                  <div className="text-2xl font-bold text-primary-600">{percentage}%</div>
                  <div className={`badge ${
                    finalLetterGrade === 'A' ? 'badge-success' :
                    finalLetterGrade === 'B' ? 'badge-primary' :
                    finalLetterGrade === 'C' ? 'badge-warning' :
                    'badge-error'
                  }`}>
                    {finalLetterGrade}
                  </div>
                </div>
              </div>
              
              {/* Missing Assignments Alert */}
              {missingAssignments.length > 0 && (
                <div className="mb-6 p-4 bg-warning-50 border border-warning-200 rounded-2xl">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-warning-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <span className="text-sm font-medium text-warning-800">
                        {missingAssignments.length} assignment(s) without grades
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        setNewGrade({
                          student_id: student.id,
                          assignment_id: '',
                          score: '',
                          feedback: ''
                        });
                        setShowAddGradeModal(true);
                      }}
                      className="btn-warning text-sm px-3 py-2"
                    >
                      Add Missing Grades
                    </button>
                  </div>
                </div>
              )}
              
              {/* Final Grade Summary */}
              <div className="mb-6 p-4 bg-primary-50 rounded-2xl">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-lg font-bold text-primary-600">{totalScore}</div>
                    <div className="text-xs text-neutral-600">Total Points</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-primary-600">{maxPossible}</div>
                    <div className="text-xs text-neutral-600">Max Possible</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-primary-600">{percentage}%</div>
                    <div className="text-xs text-neutral-600">Percentage</div>
                  </div>
                </div>
              </div>
              
              {/* Grades List */}
              {studentGrades.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-neutral-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <p className="text-neutral-500">No grades recorded yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {studentGrades.map(grade => (
                    <div key={grade.id} className="flex items-center justify-between p-4 bg-neutral-50 rounded-2xl">
                      <div className="flex-1">
                        <h4 className="font-semibold text-neutral-900">{grade.assignment?.title}</h4>
                        <p className="text-sm text-neutral-600">Due: {grade.assignment?.due_date ? new Date(grade.assignment.due_date).toLocaleDateString() : 'No due date'}</p>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="flex items-center gap-2">
                            {editingGrade === grade.id ? (
                              <input
                                type="number"
                                defaultValue={grade.score}
                                className="w-20 input text-center"
                                onBlur={(e) => handleGradeUpdate(grade.id, e.target.value, grade.feedback)}
                              />
                            ) : (
                              <span className="text-lg font-bold text-neutral-900">{grade.score}</span>
                            )}
                            <span className="text-sm text-neutral-500">/ {grade.assignment?.max_score}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            {editingGrade === grade.id ? (
                              <span className="text-neutral-400">-</span>
                            ) : (
                              <span className={`badge ${
                                calculateAssignmentLetterGrade(grade.score, grade.assignment?.max_score) === 'A' ? 'badge-success' :
                                calculateAssignmentLetterGrade(grade.score, grade.assignment?.max_score) === 'B' ? 'badge-primary' :
                                calculateAssignmentLetterGrade(grade.score, grade.assignment?.max_score) === 'C' ? 'badge-warning' :
                                'badge-error'
                              }`}>
                                {calculateAssignmentLetterGrade(grade.score, grade.assignment?.max_score)}
                              </span>
                            )}
                          </div>
                        </div>
                        
                        <button
                          onClick={() => setEditingGrade(editingGrade === grade.id ? null : grade.id)}
                          className="btn-ghost text-sm px-3 py-2"
                        >
                          {editingGrade === grade.id ? 'Save' : 'Edit'}
                        </button>
                      </div>
                    </div>
                  ))}
                  
                  {/* Show missing assignments with Add Grade buttons */}
                  {missingAssignments.map(assignment => (
                    <div key={`missing-${assignment.id}`} className="flex items-center justify-between p-4 bg-warning-50 rounded-2xl border border-warning-200">
                      <div className="flex-1">
                        <h4 className="font-semibold text-neutral-900">{assignment.title}</h4>
                        <p className="text-sm text-neutral-600">Due: {assignment.due_date ? new Date(assignment.due_date).toLocaleDateString() : 'No due date'}</p>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-bold text-neutral-400">-</span>
                            <span className="text-sm text-neutral-500">/ {assignment.max_score}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-neutral-400">-</span>
                          </div>
                        </div>
                        
                        <button
                          onClick={() => {
                            setNewGrade({
                              student_id: student.id,
                              assignment_id: assignment.id,
                              score: '',
                              feedback: ''
                            });
                            setShowAddGradeModal(true);
                          }}
                          className="btn-primary text-sm px-3 py-2"
                        >
                          Add Grade
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 loading-spinner"></div>
          <p className="text-neutral-600">Loading grades...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gradient">Grades</h2>
          <p className="text-neutral-600 mt-1">Manage and view student grades</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="flex items-center gap-3">
            <div className="text-sm text-neutral-600 bg-neutral-100 px-3 py-1 rounded-full">
              Interactive Grid View
            </div>
            <div className="text-xs text-neutral-500">
              {students.length} students × {assignments.length} assignments
            </div>
          </div>
          
          <button
            onClick={() => setShowAddGradeModal(true)}
            className="btn-primary px-4 py-2 text-sm font-semibold"
          >
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Add Grade
          </button>
        </div>
      </div>

      {error && (
        <div className="card p-4 border-l-4 border-error-500 bg-error-50">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-error-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-error-700 font-medium">{error}</p>
          </div>
        </div>
      )}

     

      {renderGridView()}

      {/* Add Grade Modal */}
      {showAddGradeModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 safe-top safe-bottom">
          <div className="bg-white rounded-3xl shadow-large w-full max-w-md p-8 animate-scale-in">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-neutral-900">Add New Grade</h3>
              <button
                onClick={() => setShowAddGradeModal(false)}
                className="p-2 hover:bg-neutral-100 rounded-xl transition-colors duration-200"
              >
                <svg className="w-5 h-5 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <form onSubmit={handleAddGrade} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">Student</label>
                <select
                  value={newGrade.student_id}
                  onChange={(e) => setNewGrade({ ...newGrade, student_id: e.target.value })}
                  className="input"
                  required
                >
                  <option value="">Select Student</option>
                  {students.map(student => (
                    <option key={student.id} value={student.id}>
                      {student.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">Assignment</label>
                <select
                  value={newGrade.assignment_id}
                  onChange={(e) => setNewGrade({ ...newGrade, assignment_id: e.target.value })}
                  className="input"
                  required
                >
                  <option value="">Select Assignment</option>
                  {assignments.map(assignment => (
                    <option key={assignment.id} value={assignment.id}>
                      {assignment.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">Score</label>
                <input
                  type="number"
                  value={newGrade.score}
                  onChange={(e) => setNewGrade({ ...newGrade, score: e.target.value })}
                  className="input"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">Feedback</label>
                <textarea
                  value={newGrade.feedback}
                  onChange={(e) => setNewGrade({ ...newGrade, feedback: e.target.value })}
                  className="input"
                  rows={3}
                />
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowAddGradeModal(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                >
                  Add Grade
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
