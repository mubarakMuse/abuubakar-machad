import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';

export default function AssignmentList({ levelCode, studentId }) {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [submission, setSubmission] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionsByAssignment, setSubmissionsByAssignment] = useState({});
  const [toast, setToast] = useState(null); // { type: 'success' | 'error', message: string }
  const [showHistoryAssignmentId, setShowHistoryAssignmentId] = useState(null);

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
      setAssignments(data || []);

      // After loading assignments, fetch student's submissions for these assignments
      const assignmentIds = (data || []).map(a => a.id);
      if (assignmentIds.length > 0 && studentId) {
        await fetchSubmissionsForAssignments(assignmentIds);
      } else {
        setSubmissionsByAssignment({});
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchSubmissionsForAssignments = async (assignmentIds) => {
    try {
      const { data, error } = await supabase
        .from('assignment_submissions')
        .select('*')
        .in('assignment_id', assignmentIds)
        .eq('student_id', studentId)
        .order('submitted_at', { ascending: false });

      if (error) throw error;

      const map = {};
      (data || []).forEach(sub => {
        if (!map[sub.assignment_id]) map[sub.assignment_id] = [];
        map[sub.assignment_id].push(sub);
      });
      setSubmissionsByAssignment(map);
    } catch (err) {
      setToast({ type: 'error', message: 'Failed to load submissions.' });
    }
  };

  const hasSubmitted = useMemo(() => {
    return (assignmentId) => (submissionsByAssignment[assignmentId]?.length || 0) > 0;
  }, [submissionsByAssignment]);

  const latestSubmission = useMemo(() => {
    return (assignmentId) => submissionsByAssignment[assignmentId]?.[0] || null;
  }, [submissionsByAssignment]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedAssignment) return;
    if (submission.trim().length < 10) {
      setToast({ type: 'error', message: 'Response must be at least 10 characters.' });
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const newSubmission = {
        assignment_id: selectedAssignment.id,
        student_id: studentId,
        content: submission.trim(),
        submitted_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('assignment_submissions')
        .insert([newSubmission])
        .select('*')
        .single();

      if (error) throw error;

      // Optimistically update local state
      setSubmissionsByAssignment(prev => {
        const prevList = prev[selectedAssignment.id] || [];
        return { ...prev, [selectedAssignment.id]: [data, ...prevList] };
      });

      setSubmission('');
      setSelectedAssignment(null);
      setToast({ type: 'success', message: 'Submission sent successfully!' });
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Failed to submit. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Auto-dismiss toasts
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-600"></div>
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

  return (
    <div className="space-y-6 relative">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white ${
          toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
        }`}>
          <div className="flex items-center gap-2">
            <span>{toast.type === 'success' ? '✅' : '⚠️'}</span>
            <span className="font-medium">{toast.message}</span>
          </div>
        </div>
      )}

      <h2 className="text-2xl font-bold text-gray-900">Assignments</h2>
      
      {assignments.length === 0 ? (
        <div className="bg-white rounded-xl p-6 shadow-md border border-indigo-100">
          <p className="text-gray-600">No assignments available yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {assignments.map((assignment) => {
            const submitted = hasSubmitted(assignment.id);
            const latest = latestSubmission(assignment.id);

            return (
              <div key={assignment.id} className="bg-white rounded-xl shadow-md overflow-hidden border border-indigo-100">
                <div className="p-6">
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="text-lg font-semibold text-gray-900">{assignment.title}</h3>
                        {submitted ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Submitted
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            Not submitted
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-sm text-gray-500 flex flex-wrap gap-3">
                        <span>Due: {new Date(assignment.due_date).toLocaleString()}</span>
                        <span>Max Score: {assignment.max_score}</span>
                        {latest && (
                          <span>Last submitted: {new Date(latest.submitted_at).toLocaleString()}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setSelectedAssignment(assignment)}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
                      >
                        {submitted ? 'Resubmit' : 'Submit Response'}
                      </button>
                      {submitted && (
                        <button
                          onClick={() => setShowHistoryAssignmentId(assignment.id)}
                          className="px-3 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                        >
                          View Submissions
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="prose prose-sm max-w-none mt-4">
                    <ReactMarkdown rehypePlugins={[rehypeSanitize]}>
                      {assignment.description}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Submission Modal */}
      {selectedAssignment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold text-gray-900">
                Submit Response: {selectedAssignment.title}
              </h3>
              <button
                onClick={() => setSelectedAssignment(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Your Response
                </label>
                <textarea
                  value={submission}
                  onChange={(e) => setSubmission(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition duration-150 ease-in-out resize-none"
                  rows={8}
                  placeholder="Enter your assignment response here..."
                  required
                />
                <div className="mt-1 text-xs text-gray-500 flex justify-between">
                  <span>Minimum 10 characters</span>
                  <span>{submission.trim().length} characters</span>
                </div>
              </div>

              <div className="flex justify-end gap-4">
                <button
                  type="button"
                  onClick={() => setSelectedAssignment(null)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`px-4 py-2 rounded-md text-white ${
                    isSubmitting
                      ? 'bg-indigo-400 cursor-not-allowed'
                      : 'bg-indigo-600 hover:bg-indigo-700'
                  }`}
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Response'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Submission History Modal */}
      {showHistoryAssignmentId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-3xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold text-gray-900">Your Submissions</h3>
              <button
                onClick={() => setShowHistoryAssignmentId(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
              {(submissionsByAssignment[showHistoryAssignmentId] || []).map((sub) => (
                <div key={sub.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="text-sm text-gray-500 mb-2">Submitted on {new Date(sub.submitted_at).toLocaleString()}</div>
                  <div className="prose prose-sm max-w-none">
                    <ReactMarkdown rehypePlugins={[rehypeSanitize]}>
                      {sub.content}
                    </ReactMarkdown>
                  </div>
                </div>
              ))}
              {(submissionsByAssignment[showHistoryAssignmentId] || []).length === 0 && (
                <div className="text-gray-500">No submissions yet.</div>
              )}
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowHistoryAssignmentId(null)}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 