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
  const [loading, setLoading] = useState(true);
  const [editingAssignment, setEditingAssignment] = useState(null);
  const [editingField, setEditingField] = useState(null); // Track which field is being edited
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
      setLoading(true);
      const { data, error } = await supabase
        .from('assignments')
        .select('*')
        .eq('level_code', levelCode)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAssignments(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
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
      if (editingAssignment) {
        const { error } = await supabase
          .from('assignments')
          .update({
            title: newAssignment.title,
            description: newAssignment.description,
            max_score: newAssignment.max_score,
            due_date: newAssignment.due_date,
          })
          .eq('id', editingAssignment.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('assignments')
          .insert([{
            ...newAssignment,
            level_code: levelCode,
            teacher_id: teacherId,
            created_at: new Date().toISOString()
          }]);

        if (error) throw error;
      }

      setNewAssignment({
        title: '',
        description: '',
        max_score: 10,
        due_date: '',
        teacher_id: teacherId
      });
      setShowAssignmentForm(false);
      setEditingAssignment(null);
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

  const handleDeleteAssignment = async (id) => {
    if (window.confirm('Are you sure you want to delete this assignment?')) {
      try {
        const { error } = await supabase
          .from('assignments')
          .delete()
          .eq('id', id);

        if (error) throw error;
        fetchAssignments();
      } catch (err) {
        setError(err.message);
      }
    }
  };


  const startEditingAssignment = (assignment) => {
    setEditingAssignment(assignment);
    setNewAssignment({
      title: assignment.title,
      description: assignment.description,
      max_score: assignment.max_score,
      due_date: assignment.due_date,
      teacher_id: teacherId
    });
    setShowAssignmentForm(true);
  };

  const handleInlineEdit = async (assignmentId, field, value) => {
    try {
      const { error } = await supabase
        .from('assignments')
        .update({ [field]: value })
        .eq('id', assignmentId);

      if (error) throw error;
      
      // Update local state
      setAssignments(assignments.map(assignment => 
        assignment.id === assignmentId 
          ? { ...assignment, [field]: value }
          : assignment
      ));
    } catch (err) {
      setError(err.message);
    }
  };

  const startInlineEdit = (assignmentId, field) => {
    setEditingField(`${assignmentId}-${field}`);
  };

  const cancelInlineEdit = () => {
    setEditingField(null);
  };

  const saveInlineEdit = async (assignmentId, field, value) => {
    if (value && value.trim() !== '') {
      await handleInlineEdit(assignmentId, field, value.trim());
    }
    setEditingField(null);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 loading-spinner"></div>
          <p className="text-neutral-600">Loading assignments...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gradient">Assignments</h2>
          <p className="text-neutral-600 mt-1">Create and manage assignments for your class</p>
        </div>
        
        <button
          onClick={() => {
            setEditingAssignment(null);
            setNewAssignment({
              title: '',
              description: '',
              max_score: 10,
              due_date: '',
              teacher_id: teacherId
            });
            setShowAssignmentForm(true);
          }}
          className="btn-primary px-4 py-2 text-sm font-semibold"
        >
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          New Assignment
        </button>
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

      <div className="space-y-6">
        {assignments.length === 0 ? (
          <div className="card p-8 text-center">
            <div className="w-16 h-16 bg-neutral-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-neutral-900 mb-2">No assignments yet</h3>
            <p className="text-neutral-500">Create your first assignment to get started.</p>
          </div>
        ) : (
          assignments.map((assignment, index) => (
            <div key={assignment.id} className="card p-6 animate-slide-up" style={{ animationDelay: `${index * 100}ms` }}>
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  {editingField === `${assignment.id}-title` ? (
                    <input
                      type="text"
                      defaultValue={assignment.title}
                      className="w-full text-lg font-bold text-neutral-900 bg-transparent border-b border-primary-500 focus:outline-none focus:border-primary-600"
                      onBlur={(e) => saveInlineEdit(assignment.id, 'title', e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.target.blur();
                        } else if (e.key === 'Escape') {
                          cancelInlineEdit();
                        }
                      }}
                      autoFocus
                    />
                  ) : (
                    <h3 
                      className="text-lg font-bold text-neutral-900 cursor-pointer hover:bg-neutral-50 p-2 rounded-lg transition-colors duration-200"
                      onClick={() => startInlineEdit(assignment.id, 'title')}
                    >
                      {assignment.title}
                    </h3>
                  )}
                  <div className="flex items-center gap-4 mt-2">
                    <p className="text-sm text-neutral-500">
                      Due: {new Date(assignment.due_date).toLocaleString()}
                    </p>
                    <span className="px-2 py-1 bg-primary-100 text-primary-700 rounded-lg text-xs font-medium">
                      Max Score: {assignment.max_score}
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setSelectedAssignment(assignment);
                      fetchEnrolledStudents();
                      setShowBulkGradeModal(true);
                    }}
                    className="btn-secondary text-sm px-3 py-2"
                  >
                    Bulk Grade
                  </button>
                  <button
                    onClick={() => {
                      setSelectedAssignment(assignment);
                      fetchAssignmentResponses(assignment.id);
                      setShowResponseModal(true);
                    }}
                    className="btn-primary text-sm px-3 py-2"
                  >
                    View Responses
                  </button>
                  <button
                    onClick={() => startEditingAssignment(assignment)}
                    className="btn-ghost text-sm px-3 py-2"
                  >
                    Edit Full
                  </button>
                  <button
                    onClick={() => handleDeleteAssignment(assignment.id)}
                    className="btn-ghost text-error-600 hover:text-error-700 text-sm px-3 py-2"
                  >
                    Delete
                  </button>
                </div>
              </div>
              
              <div className="prose prose-sm max-w-none">
                {editingField === `${assignment.id}-description` ? (
                  <textarea
                    defaultValue={assignment.description}
                    className="w-full p-3 border border-primary-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                    rows={4}
                    onBlur={(e) => saveInlineEdit(assignment.id, 'description', e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Escape') {
                        cancelInlineEdit();
                      }
                    }}
                    autoFocus
                  />
                ) : (
                  <div 
                    className="cursor-pointer hover:bg-neutral-50 p-3 rounded-lg transition-colors duration-200"
                    onClick={() => startInlineEdit(assignment.id, 'description')}
                  >
                    <ReactMarkdown rehypePlugins={[rehypeSanitize]}>
                      {assignment.description}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Assignment Form Modal */}
      {showAssignmentForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 safe-top safe-bottom">
          <div className="bg-white rounded-3xl shadow-large w-full max-w-2xl p-8 animate-scale-in">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-neutral-900">
                {editingAssignment ? 'Edit Assignment' : 'New Assignment'}
              </h3>
              <button
                onClick={() => {
                  setShowAssignmentForm(false);
                  setEditingAssignment(null);
                  setNewAssignment({
                    title: '',
                    description: '',
                    max_score: 10,
                    due_date: '',
                    teacher_id: teacherId
                  });
                }}
                className="p-2 hover:bg-neutral-100 rounded-xl transition-colors duration-200"
              >
                <svg className="w-5 h-5 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-error-50 border border-error-200 rounded-2xl">
                <div className="flex items-center gap-3">
                  <svg className="h-5 w-5 text-error-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-error-700 font-medium">{error}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleAssignmentSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">Title</label>
                <input
                  type="text"
                  value={newAssignment.title}
                  onChange={(e) => setNewAssignment({ ...newAssignment, title: e.target.value })}
                  className="input"
                  placeholder="Enter assignment title"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">Description</label>
                <textarea
                  value={newAssignment.description}
                  onChange={(e) => setNewAssignment({ ...newAssignment, description: e.target.value })}
                  className="input"
                  rows={6}
                  placeholder="Enter assignment description"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">Maximum Score</label>
                  <input
                    type="number"
                    value={newAssignment.max_score}
                    onChange={(e) => setNewAssignment({ ...newAssignment, max_score: parseInt(e.target.value) })}
                    className="input"
                    min="1"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">Due Date</label>
                  <input
                    type="datetime-local"
                    value={newAssignment.due_date}
                    onChange={(e) => setNewAssignment({ ...newAssignment, due_date: e.target.value })}
                    className="input"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowAssignmentForm(false);
                    setEditingAssignment(null);
                    setNewAssignment({
                      title: '',
                      description: '',
                      max_score: 10,
                      due_date: '',
                      teacher_id: teacherId
                    });
                  }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-primary"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 loading-spinner mr-2"></div>
                      {editingAssignment ? 'Updating...' : 'Creating...'}
                    </>
                  ) : (
                    editingAssignment ? 'Update Assignment' : 'Create Assignment'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Grade Modal */}
      {showBulkGradeModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 safe-top safe-bottom">
          <div className="bg-white rounded-3xl shadow-large w-full max-w-4xl max-h-[90vh] overflow-hidden animate-scale-in">
            <div className="flex items-center justify-between p-6 border-b border-neutral-200">
              <h3 className="text-xl font-bold text-neutral-900">
                Bulk Grade: {selectedAssignment?.title}
              </h3>
              <button
                onClick={() => {
                  setShowBulkGradeModal(false);
                  setBulkGrades({});
                  setSelectedAssignment(null);
                }}
                className="p-2 hover:bg-neutral-100 rounded-xl transition-colors duration-200"
              >
                <svg className="w-5 h-5 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 max-h-[60vh] overflow-y-auto">
              <form onSubmit={handleBulkGradeSubmit} className="space-y-4">
                {enrolledStudents.map((student) => (
                  <div key={student.id} className="flex items-center justify-between p-4 bg-neutral-50 rounded-2xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-xl flex items-center justify-center">
                        <span className="text-white font-bold text-sm">
                          {student.name.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <h4 className="font-medium text-neutral-900">{student.name}</h4>
                        <p className="text-sm text-neutral-500">@{student.username}</p>
                      </div>
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
                        className="w-24 input text-center"
                        placeholder="Score"
                      />
                      <span className="text-sm text-neutral-500">
                        /{selectedAssignment?.max_score}
                      </span>
                    </div>
                  </div>
                ))}
              </form>
            </div>

            <div className="p-6 border-t border-neutral-200">
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowBulkGradeModal(false);
                    setBulkGrades({});
                    setSelectedAssignment(null);
                  }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  onClick={handleBulkGradeSubmit}
                  disabled={isSubmitting}
                  className="btn-primary"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 loading-spinner mr-2"></div>
                      Saving...
                    </>
                  ) : (
                    'Save Grades'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Response Modal */}
      {showResponseModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 safe-top safe-bottom">
          <div className="bg-white rounded-3xl shadow-large w-full max-w-4xl max-h-[90vh] overflow-hidden animate-scale-in">
            <div className="flex items-center justify-between p-6 border-b border-neutral-200">
              <h3 className="text-xl font-bold text-neutral-900">
                Submissions: {selectedAssignment?.title}
              </h3>
              <button
                onClick={() => {
                  setShowResponseModal(false);
                  setSelectedAssignment(null);
                }}
                className="p-2 hover:bg-neutral-100 rounded-xl transition-colors duration-200"
              >
                <svg className="w-5 h-5 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 max-h-[60vh] overflow-y-auto">
              <div className="space-y-4">
                {assignmentResponses[selectedAssignment?.id]?.map((submission) => (
                  <div key={submission.id} className="card p-4">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-xl flex items-center justify-center">
                          <span className="text-white font-bold text-sm">
                            {submission.student.name.charAt(0)}
                          </span>
                        </div>
                        <div>
                          <h4 className="font-medium text-neutral-900">{submission.student.name}</h4>
                          <p className="text-sm text-neutral-500">@{submission.student.username}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        {submission.score !== null ? (
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-medium text-neutral-700">
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
                              className="btn-primary text-sm px-3 py-2"
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
                              className="w-20 input text-center"
                              placeholder="Score"
                              onChange={(e) => handleGradeResponse(submission.id, parseFloat(e.target.value))}
                            />
                            <span className="text-sm text-neutral-500">
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
                              className="btn-primary text-sm px-3 py-2"
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
                      <p className="text-sm text-neutral-500 mt-2">
                        Submitted: {new Date(submission.submitted_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
