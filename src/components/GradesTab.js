import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function GradesTab() {
  const [grades, setGrades] = useState([]);
  const [error, setError] = useState(null);
  const [editingGrade, setEditingGrade] = useState(null);
  const [showAddGradeModal, setShowAddGradeModal] = useState(false);
  const [viewMode, setViewMode] = useState('assignment'); // 'assignment' or 'student'
  const [newGrade, setNewGrade] = useState({
    student_id: '',
    assignment_id: '',
    score: '',
    feedback: ''
  });
  const [students, setStudents] = useState([]);
  const [assignments, setAssignments] = useState([]);

  useEffect(() => {
    fetchGrades();
    fetchStudents();
    fetchAssignments();
  }, []);

  const fetchGrades = async () => {
    try {
      const { data, error } = await supabase
        .from('grades')
        .select(`
          *,
          assignment:assignments(*),
          student:users(name)
        `)
        .order('graded_at', { ascending: false });

      if (error) throw error;
      setGrades(data);
    } catch (err) {
      setError(err.message);
    }
  };

  const fetchStudents = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, name')
        .eq('role', 'student');

      if (error) throw error;
      setStudents(data);
    } catch (err) {
      setError(err.message);
    }
  };

  const fetchAssignments = async () => {
    try {
      const { data, error } = await supabase
        .from('assignments')
        .select('*')
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

  const renderAssignmentView = () => {
    const gradesByAssignment = getGradesByAssignment();
    
    return (
      <div className="space-y-6">
        {assignments.map(assignment => {
          const assignmentGrades = gradesByAssignment[assignment.id]?.grades || [];
          return (
            <div key={assignment.id} className="bg-white rounded-lg shadow-md p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">{assignment.title}</h3>
                <span className="text-sm text-gray-500">Max Score: {assignment.max_score}</span>
              </div>
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Student</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Score</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Feedback</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {assignmentGrades.map(grade => (
                    <tr key={grade.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-sm text-gray-900">{grade.student?.name}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">
                        {editingGrade === grade.id ? (
                          <input
                            type="number"
                            defaultValue={grade.score}
                            className="w-20 border rounded px-2 py-1"
                            onBlur={(e) => handleGradeUpdate(grade.id, e.target.value, grade.feedback)}
                          />
                        ) : (
                          grade.score
                        )}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-900">
                        {editingGrade === grade.id ? (
                          <input
                            type="text"
                            defaultValue={grade.feedback}
                            className="w-full border rounded px-2 py-1"
                            onBlur={(e) => handleGradeUpdate(grade.id, grade.score, e.target.value)}
                          />
                        ) : (
                          grade.feedback
                        )}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-500">
                        <button
                          onClick={() => setEditingGrade(editingGrade === grade.id ? null : grade.id)}
                          className="text-indigo-600 hover:text-indigo-900"
                        >
                          {editingGrade === grade.id ? 'Save' : 'Edit'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
        {students.map(student => {
          const studentGrades = gradesByStudent[student.id]?.grades || [];
          return (
            <div key={student.id} className="bg-white rounded-lg shadow-md p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">{student.name}</h3>
                <div className="text-sm text-gray-500">
                  Total Assignments: {studentGrades.length}
                </div>
              </div>
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Assignment</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Score</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Feedback</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {studentGrades.map(grade => (
                    <tr key={grade.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-sm text-gray-900">{grade.assignment?.title}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">
                        {editingGrade === grade.id ? (
                          <input
                            type="number"
                            defaultValue={grade.score}
                            className="w-20 border rounded px-2 py-1"
                            onBlur={(e) => handleGradeUpdate(grade.id, e.target.value, grade.feedback)}
                          />
                        ) : (
                          grade.score
                        )}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-900">
                        {editingGrade === grade.id ? (
                          <input
                            type="text"
                            defaultValue={grade.feedback}
                            className="w-full border rounded px-2 py-1"
                            onBlur={(e) => handleGradeUpdate(grade.id, grade.score, e.target.value)}
                          />
                        ) : (
                          grade.feedback
                        )}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-500">
                        <button
                          onClick={() => setEditingGrade(editingGrade === grade.id ? null : grade.id)}
                          className="text-indigo-600 hover:text-indigo-900"
                        >
                          {editingGrade === grade.id ? 'Save' : 'Edit'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
          Grades
        </h2>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setViewMode('assignment')}
              className={`px-4 py-2 rounded-md ${
                viewMode === 'assignment'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              By Assignment
            </button>
            <button
              onClick={() => setViewMode('student')}
              className={`px-4 py-2 rounded-md ${
                viewMode === 'student'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              By Student
            </button>
          </div>
          <button
            onClick={() => setShowAddGradeModal(true)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors duration-200"
          >
            Add Grade
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {viewMode === 'assignment' ? renderAssignmentView() : renderStudentView()}

      {/* Add Grade Modal */}
      {showAddGradeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium mb-4">Add New Grade</h3>
            <form onSubmit={handleAddGrade} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Student</label>
                <select
                  value={newGrade.student_id}
                  onChange={(e) => setNewGrade({ ...newGrade, student_id: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
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
                <label className="block text-sm font-medium text-gray-700">Assignment</label>
                <select
                  value={newGrade.assignment_id}
                  onChange={(e) => setNewGrade({ ...newGrade, assignment_id: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
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
                <label className="block text-sm font-medium text-gray-700">Score</label>
                <input
                  type="number"
                  value={newGrade.score}
                  onChange={(e) => setNewGrade({ ...newGrade, score: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Feedback</label>
                <textarea
                  value={newGrade.feedback}
                  onChange={(e) => setNewGrade({ ...newGrade, feedback: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                  rows={3}
                />
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowAddGradeModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
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