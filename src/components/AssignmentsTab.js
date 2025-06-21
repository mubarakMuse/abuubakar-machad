import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import { supabase } from '../lib/supabase';

export default function AssignmentsTab({ levelCode, teacherId }) {
  const [assignments, setAssignments] = useState([]);
  const [showAssignmentForm, setShowAssignmentForm] = useState(false);
  const [showBulkGradeModal, setShowBulkGradeModal] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [enrolledStudents, setEnrolledStudents] = useState([]);
  const [bulkGrades, setBulkGrades] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [newAssignment, setNewAssignment] = useState({
    title: '',
    description: '',
    max_score: 10,
    due_date: '',
    teacher_id: teacherId
  });
  const [assignmentResponses, setAssignmentResponses] = useState({});
  const [showResponseModal, setShowResponseModal] = useState(false);
  const [selectedResponse, setSelectedResponse] = useState(null);

  useEffect(() => {
    fetchAssignments();
  }, [levelCode]);

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

  const fetchEnrolledStudents = async () => {
    try {
      const { data, error } = await supabase
        .from('student_enrollment')
        .select(`
          student:users (
            id,
            name,
            username
          )
        `)
        .eq('level_code', levelCode);

      if (error) throw error;
      setEnrolledStudents(data.map(item => item.student));
    } catch (err) {
      setError(err.message);
    }
  };

  const fetchAssignmentResponses = async (assignmentId) => {
    try {
      const { data, error } = await supabase
        .from('assignment_submissions')
        .select(`
          *,
          student:student_id (
            id,
            name,
            username
          )
        `)
        .eq('assignment_id', assignmentId)
        .order('submitted_at', { ascending: false });

      if (error) throw error;
      setAssignmentResponses(prev => ({
        ...prev,
        [assignmentId]: data
      }));
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAssignmentSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const { error } = await supabase
        .from('assignments')
        .insert([{
          ...newAssignment,
          level_code: levelCode,
          teacher_id: teacherId,
          created_at: new Date().toISOString()
        }]);

      if (error) throw error;

      setNewAssignment({
        title: '',
        description: '',
        max_score: 10,
        due_date: '',
        teacher_id: teacherId
      });
      setShowAssignmentForm(false);
      fetchAssignments();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBulkGradeSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const gradesToInsert = Object.entries(bulkGrades).map(([studentId, grade]) => ({
        assignment_id: selectedAssignment.id,
        student_id: studentId,
        score: parseFloat(grade),
        graded_at: new Date().toISOString()
      }));

      const { error } = await supabase
        .from('grades')
        .upsert(gradesToInsert, { onConflict: 'assignment_id,student_id' });

      if (error) throw error;

      setShowBulkGradeModal(false);
      setBulkGrades({});
      setSelectedAssignment(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGradeResponse = async (submissionId, score) => {
    try {
      // First get the submission to get the student_id and assignment_id
      const { data: submission, error: submissionError } = await supabase
        .from('assignment_submissions')
        .select('student_id, assignment_id')
        .eq('id', submissionId)
        .single();

      if (submissionError) throw submissionError;

      // Then upsert the grade
      const { error } = await supabase
        .from('grades')
        .upsert({
          assignment_id: submission.assignment_id,
          student_id: submission.student_id,
          score: score,
          graded_at: new Date().toISOString()
        }, { 
          onConflict: 'assignment_id,student_id'
        });

      if (error) throw error;
      
      // Refresh the responses to show updated grades
      if (selectedAssignment) {
        fetchAssignmentResponses(selectedAssignment.id);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const renderAssignmentCard = (assignment) => (
    <div key={assignment.id} className="bg-white rounded-2xl shadow-lg p-8 border border-indigo-100">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-xl font-bold text-gray-900">{assignment.title}</h3>
          <p className="text-sm text-gray-500">
            Due: {new Date(assignment.due_date).toLocaleString()}
          </p>
          <p className="text-sm text-gray-500">
            Teacher ID: {assignment.teacher_id}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded-md text-sm">
            Max Score: {assignment.max_score}
          </span>
          <button
            onClick={() => {
              setSelectedAssignment(assignment);
              fetchEnrolledStudents();
              setShowBulkGradeModal(true);
            }}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors duration-200"
          >
            Bulk Grade
          </button>
          <button
            onClick={() => {
              setSelectedAssignment(assignment);
              fetchAssignmentResponses(assignment.id);
              setShowResponseModal(true);
            }}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors duration-200"
          >
            View Responses
          </button>
        </div>
      </div>
      
      {assignment.description && (
        <div className="prose prose-sm max-w-none mt-4">
          <ReactMarkdown rehypePlugins={[rehypeSanitize]}>
            {assignment.description}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );

  const renderBulkGradeModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-lg p-8 border border-indigo-100 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Bulk Grade: {selectedAssignment?.title}
          </h3>
          <button
            onClick={() => {
              setShowBulkGradeModal(false);
              setBulkGrades({});
              setSelectedAssignment(null);
            }}
            className="text-gray-500 hover:text-gray-700"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleBulkGradeSubmit} className="space-y-6">
          <div className="space-y-4">
            {enrolledStudents.map((student) => (
              <div key={student.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <h4 className="font-medium text-gray-900">{student.name}</h4>
                  <p className="text-sm text-gray-500">@{student.username}</p>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    min="0"
                    max={selectedAssignment?.max_score}
                    step="0.01"
                    value={bulkGrades[student.id] || ''}
                    onChange={(e) => setBulkGrades({
                      ...bulkGrades,
                      [student.id]: e.target.value
                    })}
                    className="w-24 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Score"
                  />
                  <span className="text-sm text-gray-500">
                    /{selectedAssignment?.max_score}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-4 pt-4">
            <button
              type="button"
              onClick={() => {
                setShowBulkGradeModal(false);
                setBulkGrades({});
                setSelectedAssignment(null);
              }}
              className="px-6 py-3 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`inline-flex items-center px-6 py-3 rounded-lg text-white font-semibold ${
                isSubmitting 
                  ? 'bg-indigo-400 cursor-not-allowed' 
                  : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700'
              }`}
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving...
                </>
              ) : 'Save Grades'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  const renderResponseModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-lg p-8 border border-indigo-100 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Submissions: {selectedAssignment?.title}
          </h3>
          <button
            onClick={() => {
              setShowResponseModal(false);
              setSelectedAssignment(null);
            }}
            className="text-gray-500 hover:text-gray-700"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          {assignmentResponses[selectedAssignment?.id]?.map((submission) => (
            <div key={submission.id} className="bg-gray-50 rounded-lg p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h4 className="font-medium text-gray-900">{submission.student.name}</h4>
                  <p className="text-sm text-gray-500">@{submission.student.username}</p>
                </div>
                <div className="flex items-center space-x-4">
                  {submission.score !== null ? (
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium text-gray-700">
                        Score: {submission.score}/{selectedAssignment.max_score}
                      </span>
                      <button
                        onClick={() => {
                          const newScore = prompt(`Enter new score (max ${selectedAssignment.max_score}):`, submission.score);
                          if (newScore !== null) {
                            const score = parseFloat(newScore);
                            if (!isNaN(score) && score >= 0 && score <= selectedAssignment.max_score) {
                              handleGradeResponse(submission.id, score);
                            } else {
                              alert('Please enter a valid score between 0 and ' + selectedAssignment.max_score);
                            }
                          }
                        }}
                        className="px-3 py-1 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors duration-200"
                      >
                        Update Grade
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <input
                        type="number"
                        min="0"
                        max={selectedAssignment.max_score}
                        step="0.01"
                        className="w-20 px-2 py-1 border border-gray-300 rounded-md"
                        placeholder="Score"
                        onChange={(e) => handleGradeResponse(submission.id, parseFloat(e.target.value))}
                      />
                      <span className="text-sm text-gray-500">
                        /{selectedAssignment.max_score}
                      </span>
                      <button
                        onClick={() => {
                          const score = parseFloat(document.querySelector(`input[placeholder="Score"]`).value);
                          if (!isNaN(score) && score >= 0 && score <= selectedAssignment.max_score) {
                            handleGradeResponse(submission.id, score);
                          } else {
                            alert('Please enter a valid score between 0 and ' + selectedAssignment.max_score);
                          }
                        }}
                        className="px-3 py-1 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors duration-200"
                      >
                        Grade
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div className="prose prose-sm max-w-none">
                <ReactMarkdown rehypePlugins={[rehypeSanitize]}>
                  {submission.content}
                </ReactMarkdown>
              </div>
              {submission.submitted_at && (
                <p className="text-sm text-gray-500 mt-2">
                  Submitted: {new Date(submission.submitted_at).toLocaleString()}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
          Assignments
        </h2>
        <button
          onClick={() => setShowAssignmentForm(true)}
          className="px-6 py-3 rounded-lg text-white font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 ease-in-out"
        >
          New Assignment
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg">
          <div className="flex items-center gap-3">
            <svg className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-red-700 font-medium">{error}</p>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {assignments.map(renderAssignmentCard)}
      </div>

      {/* Assignment Form Modal */}
      {showAssignmentForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-lg p-8 border border-indigo-100 w-full max-w-2xl">
            <div className="flex items-center gap-4 mb-6">
              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                New Assignment
              </h3>
            </div>

            <form onSubmit={handleAssignmentSubmit} className="space-y-6">
              <div className="space-y-4">
                <div>
                  <label htmlFor="title" className="block text-sm font-semibold text-gray-700 mb-2">
                    Title
                  </label>
                  <input
                    type="text"
                    id="title"
                    value={newAssignment.title}
                    onChange={(e) => setNewAssignment({ ...newAssignment, title: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition duration-150 ease-in-out"
                    placeholder="Enter assignment title"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="description" className="block text-sm font-semibold text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    id="description"
                    value={newAssignment.description}
                    onChange={(e) => setNewAssignment({ ...newAssignment, description: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition duration-150 ease-in-out resize-none"
                    rows={6}
                    placeholder="Enter assignment description"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="max_score" className="block text-sm font-semibold text-gray-700 mb-2">
                      Maximum Score
                    </label>
                    <input
                      type="number"
                      id="max_score"
                      value={newAssignment.max_score}
                      onChange={(e) => setNewAssignment({ ...newAssignment, max_score: parseInt(e.target.value) })}
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition duration-150 ease-in-out"
                      min="1"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="due_date" className="block text-sm font-semibold text-gray-700 mb-2">
                      Due Date
                    </label>
                    <input
                      type="datetime-local"
                      id="due_date"
                      value={newAssignment.due_date}
                      onChange={(e) => setNewAssignment({ ...newAssignment, due_date: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition duration-150 ease-in-out"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAssignmentForm(false)}
                  className="px-6 py-3 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition duration-150 ease-in-out"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`inline-flex items-center px-6 py-3 rounded-lg text-white font-semibold transition-all duration-200 ease-in-out ${
                    isSubmitting 
                      ? 'bg-indigo-400 cursor-not-allowed' 
                      : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Creating...
                    </>
                  ) : 'Create Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add the bulk grade modal */}
      {showBulkGradeModal && renderBulkGradeModal()}

      {/* Add the response modal */}
      {showResponseModal && renderResponseModal()}
    </div>
  );
}