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
  const [toast, setToast] = useState(null);
  const [showHistoryAssignmentId, setShowHistoryAssignmentId] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all'); // all, submitted, pending

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

  const filteredAssignments = useMemo(() => {
    if (filterStatus === 'all') return assignments;
    return assignments.filter(assignment => {
      const submitted = hasSubmitted(assignment.id);
      return filterStatus === 'submitted' ? submitted : !submitted;
    });
  }, [assignments, filterStatus, hasSubmitted]);

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

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="w-8 h-8 loading-spinner"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-4">
        <div className="flex items-center gap-3">
          <svg className="w-5 h-5 text-error-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-error-700 text-mobile-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 relative">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white animate-slide-up ${
          toast.type === 'success' ? 'bg-success-600' : 'bg-error-600'
        }`}>
          <div className="flex items-center gap-2">
            <span>{toast.type === 'success' ? '✅' : '⚠️'}</span>
            <span className="font-medium text-sm">{toast.message}</span>
          </div>
        </div>
      )}

      {/* Header with Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-mobile-xl font-bold text-neutral-900">Assignments</h2>
        
        {assignments.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-mobile-xs text-neutral-600">Filter:</span>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="text-mobile-xs border border-neutral-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="all">All</option>
              <option value="submitted">Submitted</option>
              <option value="pending">Pending</option>
            </select>
          </div>
        )}
      </div>
      
      {filteredAssignments.length === 0 ? (
        <div className="card p-6 text-center">
          <div className="w-12 h-12 bg-neutral-100 rounded-xl flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-mobile-base font-bold text-neutral-900 mb-2">
            {filterStatus === 'all' ? 'No assignments available' : `No ${filterStatus} assignments`}
          </h3>
          <p className="text-mobile-xs text-neutral-600">
            {filterStatus === 'all' ? 'Assignments will appear here when created.' : `No ${filterStatus} assignments found.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAssignments.map((assignment, index) => {
            const submitted = hasSubmitted(assignment.id);
            const latest = latestSubmission(assignment.id);
            const isOverdue = assignment.due_date && new Date(assignment.due_date) < new Date() && !submitted;

            return (
              <div key={assignment.id} className="card p-4 animate-slide-up" style={{ animationDelay: `${index * 100}ms` }}>
                <div className="space-y-3">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-mobile-base font-bold text-neutral-900 truncate">{assignment.title}</h3>
                        {submitted ? (
                          <span className="badge badge-success">Submitted</span>
                        ) : isOverdue ? (
                          <span className="badge badge-error">Overdue</span>
                        ) : (
                          <span className="badge badge-warning">Pending</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2 text-mobile-xs text-neutral-500">
                        <span>Due: {assignment.due_date ? new Date(assignment.due_date).toLocaleDateString() : 'No due date'}</span>
                        <span>•</span>
                        <span>Max: {assignment.max_score} pts</span>
                        {latest && (
                          <>
                            <span>•</span>
                            <span>Last: {new Date(latest.submitted_at).toLocaleDateString()}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Description Preview */}
                  {assignment.description && (
                    <div className="prose prose-sm max-w-none text-mobile-xs text-neutral-600 line-clamp-2">
                      <ReactMarkdown rehypePlugins={[rehypeSanitize]}>
                        {assignment.description.length > 100 
                          ? assignment.description.substring(0, 100) + '...' 
                          : assignment.description
                        }
                      </ReactMarkdown>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex flex-col sm:flex-row gap-2 pt-2">
                    <button
                      onClick={() => setSelectedAssignment(assignment)}
                      className="btn-primary flex-1 flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      <span>{submitted ? 'Resubmit' : 'Submit Response'}</span>
                    </button>
                    
                    {submitted && (
                      <button
                        onClick={() => setShowHistoryAssignmentId(assignment.id)}
                        className="btn-secondary flex items-center justify-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="hidden sm:inline">History</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Submission Modal */}
      {selectedAssignment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-2xl max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-neutral-200">
              <h3 className="text-mobile-lg font-bold text-neutral-900">
                {selectedAssignment.title}
              </h3>
              <button
                onClick={() => setSelectedAssignment(null)}
                className="btn-ghost p-1"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-4 max-h-[60vh] overflow-y-auto">
              {/* Assignment Details */}
              <div className="mb-4 p-3 bg-neutral-50 rounded-lg">
                <div className="text-mobile-xs text-neutral-600 mb-2">
                  Due: {selectedAssignment.due_date ? new Date(selectedAssignment.due_date).toLocaleString() : 'No due date'} • 
                  Max Score: {selectedAssignment.max_score} points
                </div>
                {selectedAssignment.description && (
                  <div className="prose prose-sm max-w-none text-mobile-sm">
                    <ReactMarkdown rehypePlugins={[rehypeSanitize]}>
                      {selectedAssignment.description}
                    </ReactMarkdown>
                  </div>
                )}
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-mobile-sm font-medium text-neutral-700 mb-2">
                    Your Response
                  </label>
                  <textarea
                    value={submission}
                    onChange={(e) => setSubmission(e.target.value)}
                    className="input resize-none"
                    rows={6}
                    placeholder="Enter your assignment response here..."
                    required
                  />
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-mobile-xs text-neutral-500">Minimum 10 characters</span>
                    <span className="text-mobile-xs text-neutral-500">{submission.trim().length} characters</span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedAssignment(null)}
                    className="btn-secondary flex-1"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || submission.trim().length < 10}
                    className="btn-primary flex-1 flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-4 h-4 loading-spinner"></div>
                        <span>Submitting...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>Submit Response</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Submission History Modal */}
      {showHistoryAssignmentId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-2xl max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-neutral-200">
              <h3 className="text-mobile-lg font-bold text-neutral-900">Submission History</h3>
              <button
                onClick={() => setShowHistoryAssignmentId(null)}
                className="btn-ghost p-1"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-4 max-h-[60vh] overflow-y-auto space-y-3">
              {(submissionsByAssignment[showHistoryAssignmentId] || []).map((sub, index) => (
                <div key={sub.id} className="border border-neutral-200 rounded-lg p-3">
                  <div className="text-mobile-xs text-neutral-500 mb-2">
                    Submission #{index + 1} • {new Date(sub.submitted_at).toLocaleString()}
                  </div>
                  <div className="prose prose-sm max-w-none text-mobile-sm">
                    <ReactMarkdown rehypePlugins={[rehypeSanitize]}>
                      {sub.content}
                    </ReactMarkdown>
                  </div>
                </div>
              ))}
              {(submissionsByAssignment[showHistoryAssignmentId] || []).length === 0 && (
                <div className="text-center py-8">
                  <p className="text-mobile-sm text-neutral-500">No submissions yet.</p>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-neutral-200">
              <button
                onClick={() => setShowHistoryAssignmentId(null)}
                className="btn-secondary w-full"
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