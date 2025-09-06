import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function AttendanceTab({ levelCode }) {
  const [attendance, setAttendance] = useState([]);
  const [previousAttendance, setPreviousAttendance] = useState([]);
  const [showAttendanceForm, setShowAttendanceForm] = useState(false);
  const [showBulkAttendanceModal, setShowBulkAttendanceModal] = useState(false);
  const [showPreviousAttendance, setShowPreviousAttendance] = useState(false);
  const [enrolledStudents, setEnrolledStudents] = useState([]);
  const [bulkAttendance, setBulkAttendance] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [selectedDate, setSelectedDate] = useState(getLocalDateString());
  const [editingAttendance, setEditingAttendance] = useState(null);
  const [dateRange, setDateRange] = useState({
    startDate: getLocalDateString(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)),
    endDate: getLocalDateString()
  });
  const [quickActions, setQuickActions] = useState({
    markAllPresent: false,
    markAllAbsent: false
  });

  // Helper function to get local date string
  function getLocalDateString(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  useEffect(() => {
    fetchAttendance();
    fetchEnrolledStudents();
    if (showPreviousAttendance) {
      fetchPreviousAttendance();
    }
  }, [levelCode, selectedDate, showPreviousAttendance, dateRange]);

  const fetchAttendance = async () => {
    try {
      const { data, error } = await supabase
        .from('attendance')
        .select(`
          *,
          student:student_id (
            id,
            name,
            username
          )
        `)
        .eq('level_code', levelCode)
        .eq('date', selectedDate)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAttendance(data);
    } catch (err) {
      setError(err.message);
    }
  };

  const fetchPreviousAttendance = async () => {
    try {
      const { data, error } = await supabase
        .from('attendance')
        .select(`
          *,
          student:student_id (
            id,
            name,
            username
          )
        `)
        .eq('level_code', levelCode)
        .gte('date', dateRange.startDate)
        .lte('date', dateRange.endDate)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPreviousAttendance(data);
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

  const handleBulkAttendanceSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      // First, delete any existing attendance records for this date and level
      const { error: deleteError } = await supabase
        .from('attendance')
        .delete()
        .eq('level_code', levelCode)
        .eq('date', selectedDate);

      if (deleteError) throw deleteError;

      // Then insert the new attendance records
      const attendanceToInsert = Object.entries(bulkAttendance).map(([studentId, status]) => ({
        student_id: studentId,
        level_code: levelCode,
        status,
        date: selectedDate,
        created_at: new Date().toISOString()
      }));

      const { error: insertError } = await supabase
        .from('attendance')
        .insert(attendanceToInsert);

      if (insertError) throw insertError;

      setShowBulkAttendanceModal(false);
      setBulkAttendance({});
      setQuickActions({ markAllPresent: false, markAllAbsent: false });
      fetchAttendance();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleIndividualAttendanceUpdate = async (attendanceId, newStatus) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const { error } = await supabase
        .from('attendance')
        .update({ status: newStatus })
        .eq('id', attendanceId);

      if (error) throw error;

      setAttendance(attendance.map(record => 
        record.id === attendanceId 
          ? { ...record, status: newStatus }
          : record
      ));
      
      setEditingAttendance(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickAction = (action) => {
    const newBulkAttendance = {};
    enrolledStudents.forEach(student => {
      newBulkAttendance[student.id] = action === 'present' ? 'present' : 'absent';
    });
    setBulkAttendance(newBulkAttendance);
    setQuickActions({
      markAllPresent: action === 'present',
      markAllAbsent: action === 'absent'
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'present':
        return 'bg-success-100 text-success-800';
      case 'absent':
        return 'bg-error-100 text-error-800';
      case 'late':
        return 'bg-warning-100 text-warning-800';
      case 'excused':
        return 'bg-primary-100 text-primary-800';
      default:
        return 'bg-neutral-100 text-neutral-800';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'present':
        return '✅';
      case 'absent':
        return '❌';
      case 'late':
        return '⏰';
      case 'excused':
        return '📝';
      default:
        return '❓';
    }
  };

  const formatDate = (dateString) => {
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const groupAttendanceByDate = (attendanceData) => {
    return attendanceData.reduce((groups, record) => {
      const date = record.date;
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(record);
      return groups;
    }, {});
  };

  const renderAttendanceCard = (record) => (
    <div key={record.id} className="card p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-xl flex items-center justify-center">
            <span className="text-white font-bold text-sm">
              {record.student.name.charAt(0)}
            </span>
          </div>
          <div>
            <h3 className="text-mobile-sm font-bold text-neutral-900">{record.student.name}</h3>
            <p className="text-mobile-xs text-neutral-500">@{record.student.username}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {editingAttendance === record.id ? (
            <div className="flex items-center gap-2">
              <select
                value={record.status}
                onChange={(e) => handleIndividualAttendanceUpdate(record.id, e.target.value)}
                className="text-mobile-xs border border-neutral-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary-500"
                disabled={isSubmitting}
              >
                <option value="present">Present</option>
                <option value="absent">Absent</option>
                <option value="late">Late</option>
                <option value="excused">Excused</option>
              </select>
              <button
                onClick={() => setEditingAttendance(null)}
                className="btn-ghost p-1"
                disabled={isSubmitting}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ) : (
            <>
              <span className={`badge ${getStatusColor(record.status)} flex items-center gap-1`}>
                <span>{getStatusIcon(record.status)}</span>
                <span className="capitalize">{record.status}</span>
              </span>
              <button
                onClick={() => setEditingAttendance(record.id)}
                className="btn-ghost p-1"
                disabled={isSubmitting}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );

  const renderPreviousAttendance = () => {
    const groupedAttendance = groupAttendanceByDate(previousAttendance);
    const sortedDates = Object.keys(groupedAttendance).sort((a, b) => new Date(b) - new Date(a));

    return (
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h3 className="text-mobile-lg font-bold text-neutral-900">Previous Attendance</h3>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange({...dateRange, startDate: e.target.value})}
              className="text-mobile-xs border border-neutral-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange({...dateRange, endDate: e.target.value})}
              className="text-mobile-xs border border-neutral-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        {sortedDates.length === 0 ? (
          <div className="card p-6 text-center">
            <div className="w-12 h-12 bg-neutral-100 rounded-xl flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h3 className="text-mobile-base font-bold text-neutral-900 mb-2">No attendance records</h3>
            <p className="text-mobile-xs text-neutral-600">No attendance has been recorded for the selected date range.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {sortedDates.map((date) => (
              <div key={date} className="card p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3">
                  <h4 className="text-mobile-base font-bold text-neutral-900">{formatDate(date)}</h4>
                  <div className="flex items-center gap-2 text-mobile-xs text-neutral-600">
                    <span>{groupedAttendance[date].length} students</span>
                    <div className="flex items-center gap-1">
                      <span className="text-success-600">
                        {groupedAttendance[date].filter(r => r.status === 'present').length} Present
                      </span>
                      <span className="text-error-600">
                        {groupedAttendance[date].filter(r => r.status === 'absent').length} Absent
                      </span>
                      <span className="text-warning-600">
                        {groupedAttendance[date].filter(r => r.status === 'late').length} Late
                      </span>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  {groupedAttendance[date].map((record) => (
                    <div key={record.id} className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{getStatusIcon(record.status)}</span>
                        <div>
                          <h5 className="text-mobile-sm font-medium text-neutral-900">{record.student.name}</h5>
                          <p className="text-mobile-xs text-neutral-500">@{record.student.username}</p>
                        </div>
                      </div>
                      <span className={`badge ${getStatusColor(record.status)}`}>
                        {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderBulkAttendanceModal = () => (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-2xl max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-neutral-200">
          <h3 className="text-mobile-lg font-bold text-neutral-900">
            Take Attendance - {formatDate(selectedDate)}
          </h3>
          <button
            onClick={() => {
              setShowBulkAttendanceModal(false);
              setBulkAttendance({});
              setQuickActions({ markAllPresent: false, markAllAbsent: false });
            }}
            className="btn-ghost p-1"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 max-h-[60vh] overflow-y-auto">
          {/* Quick Actions */}
          <div className="mb-4 p-3 bg-neutral-50 rounded-lg">
            <h4 className="text-mobile-sm font-medium text-neutral-900 mb-2">Quick Actions</h4>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleQuickAction('present')}
                className={`btn ${quickActions.markAllPresent ? 'btn-success' : 'btn-secondary'} flex-1`}
              >
                ✅ Mark All Present
              </button>
              <button
                type="button"
                onClick={() => handleQuickAction('absent')}
                className={`btn ${quickActions.markAllAbsent ? 'btn-error' : 'btn-secondary'} flex-1`}
              >
                ❌ Mark All Absent
              </button>
            </div>
          </div>

          <form onSubmit={handleBulkAttendanceSubmit} className="space-y-3">
            {enrolledStudents.map((student) => (
              <div key={student.id} className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold text-xs">
                      {student.name.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <h4 className="text-mobile-sm font-medium text-neutral-900">{student.name}</h4>
                    <p className="text-mobile-xs text-neutral-500">@{student.username}</p>
                  </div>
                </div>
                <select
                  value={bulkAttendance[student.id] || ''}
                  onChange={(e) => setBulkAttendance({
                    ...bulkAttendance,
                    [student.id]: e.target.value
                  })}
                  className="text-mobile-xs border border-neutral-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Select Status</option>
                  <option value="present">Present</option>
                  <option value="absent">Absent</option>
                  <option value="late">Late</option>
                  <option value="excused">Excused</option>
                </select>
              </div>
            ))}
          </form>
        </div>

        <div className="p-4 border-t border-neutral-200">
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={() => {
                setShowBulkAttendanceModal(false);
                setBulkAttendance({});
                setQuickActions({ markAllPresent: false, markAllAbsent: false });
              }}
              className="btn-secondary flex-1"
            >
              Cancel
            </button>
            <button
              type="submit"
              onClick={handleBulkAttendanceSubmit}
              disabled={isSubmitting}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 loading-spinner"></div>
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Save Attendance</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-mobile-xl font-bold text-neutral-900">Attendance</h2>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="text-mobile-xs border border-neutral-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <button
            onClick={() => setShowPreviousAttendance(!showPreviousAttendance)}
            className={`btn ${showPreviousAttendance ? 'btn-secondary' : 'btn-primary'}`}
          >
            {showPreviousAttendance ? 'Hide Previous' : 'Show Previous'}
          </button>
          <button
            onClick={() => {
              setShowBulkAttendanceModal(true);
              fetchEnrolledStudents();
            }}
            className="btn-primary flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="hidden sm:inline">Take Attendance</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-error-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-error-700 text-mobile-sm">{error}</p>
          </div>
        </div>
      )}

      {showPreviousAttendance ? (
        renderPreviousAttendance()
      ) : (
        <div className="space-y-4">
          <h3 className="text-mobile-base font-bold text-neutral-900">
            Today's Attendance - {formatDate(selectedDate)}
          </h3>
          {attendance.length === 0 ? (
            <div className="card p-6 text-center">
              <div className="w-12 h-12 bg-neutral-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <h3 className="text-mobile-base font-bold text-neutral-900 mb-2">No attendance recorded</h3>
              <p className="text-mobile-xs text-neutral-600">
                No attendance has been recorded for {formatDate(selectedDate)}.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {attendance.map(renderAttendanceCard)}
            </div>
          )}
        </div>
      )}

      {showBulkAttendanceModal && renderBulkAttendanceModal()}
    </div>
  );
}
