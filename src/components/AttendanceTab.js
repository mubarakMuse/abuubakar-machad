import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function AttendanceTab({ levelCode }) {
  const [students, setStudents] = useState([]);
  const [attendanceData, setAttendanceData] = useState({});
  const [attendanceDates, setAttendanceDates] = useState([]);
  const [selectedDate, setSelectedDate] = useState(getLocalDateString());
  const [showAddAttendance, setShowAddAttendance] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [editingCell, setEditingCell] = useState(null);

  // Helper function to get local date string
  function getLocalDateString(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  useEffect(() => {
    fetchStudents();
    fetchAllAttendanceData();
  }, [levelCode]);

  const fetchStudents = async () => {
    try {
      const { data, error } = await supabase
        .from('student_enrollment')
        .select(`
          student:users (
            id,
            name,
            username,
            code
          )
        `)
        .eq('level_code', levelCode);

      if (error) throw error;
      
      // Sort students by name after fetching
      const students = data.map(item => item.student).sort((a, b) => 
        a.name.localeCompare(b.name)
      );
      setStudents(students);
    } catch (err) {
      setError(err.message);
    }
  };

  const fetchAllAttendanceData = async () => {
    try {
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('level_code', levelCode)
        .order('date', { ascending: false });

      if (error) throw error;

      // Get unique dates where attendance has been taken
      const dates = [...new Set(data.map(record => record.date))].sort((a, b) => new Date(b) - new Date(a));
      setAttendanceDates(dates);

      // Transform data into a more usable format
      const attendanceMap = {};
      data.forEach(record => {
        const key = `${record.student_id}-${record.date}`;
        attendanceMap[key] = record;
      });

      setAttendanceData(attendanceMap);
    } catch (err) {
      setError(err.message);
    }
  };


  const handleAttendanceChange = async (studentId, date, status) => {
    const key = `${studentId}-${date}`;
    const existingRecord = attendanceData[key];

    try {
    setIsSubmitting(true);
    setError(null);

      if (existingRecord) {
        // Update existing record
        const { error } = await supabase
        .from('attendance')
          .update({ 
            status,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingRecord.id);

        if (error) throw error;
      } else {
        // Create new record
        const { error } = await supabase
          .from('attendance')
          .insert([{
        student_id: studentId,
        level_code: levelCode,
            date,
        status,
        created_at: new Date().toISOString()
          }]);

        if (error) throw error;
      }

      // Update local state
      setAttendanceData(prev => ({
        ...prev,
        [key]: {
          ...existingRecord,
          student_id: studentId,
          level_code: levelCode,
          date,
          status,
          id: existingRecord?.id || Date.now()
        }
      }));

      // Refresh data to get updated dates
      await fetchAllAttendanceData();
      setSuccess(`Attendance updated for ${students.find(s => s.id === studentId)?.name}`);
      setTimeout(() => setSuccess(null), 3000);

    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
      setEditingCell(null);
    }
  };

  const handleAddNewAttendance = async () => {
    try {
    setIsSubmitting(true);
    setError(null);

      // Check if attendance already exists for this date
      const existingAttendance = Object.values(attendanceData).filter(record => record.date === selectedDate);
      
      if (existingAttendance.length > 0) {
        setError(`Attendance already exists for ${formatDate(selectedDate)}. Please edit existing records.`);
        return;
      }

      // Create attendance records for all students
      const recordsToCreate = students.map(student => ({
        student_id: student.id,
        level_code: levelCode,
        date: selectedDate,
        status: 'present', // Default to present
        created_at: new Date().toISOString()
      }));

      const { error } = await supabase
        .from('attendance')
        .insert(recordsToCreate);

      if (error) throw error;

      // Refresh data
      await fetchAllAttendanceData();
      setShowAddAttendance(false);
      setSuccess(`Attendance added for ${formatDate(selectedDate)}`);
      setTimeout(() => setSuccess(null), 3000);

    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'present': return 'bg-green-100 text-green-800 border-green-200';
      case 'absent': return 'bg-red-100 text-red-800 border-red-200';
      case 'late': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'excused': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'present': return '✅';
      case 'absent': return '❌';
      case 'late': return '⏰';
      case 'excused': return '📝';
      default: return '❓';
    }
  };

  const formatDate = (dateString) => {
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  const getAttendanceForStudent = (studentId, date) => {
    const key = `${studentId}-${date}`;
    return attendanceData[key]?.status || '';
  };

  // Calculate attendance statistics for a student
  const getStudentAttendanceStats = (studentId) => {
    const studentAttendance = Object.values(attendanceData).filter(record => record.student_id === studentId);
    
    const stats = {
      present: 0,
      absent: 0,
      late: 0,
      excused: 0,
      total: studentAttendance.length
    };

    studentAttendance.forEach(record => {
      if (record.status) {
        stats[record.status] = (stats[record.status] || 0) + 1;
      }
    });

    // Calculate percentage (present + excused count as full attendance, late counts as 0.5)
    const weightedScore = stats.present + stats.excused + (stats.late * 0.5);
    const totalPossible = stats.total;
    const percentage = totalPossible > 0 ? Math.round((weightedScore / totalPossible) * 100) : 0;

    return { ...stats, percentage };
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Attendance</h2>
          <div className="text-xs text-gray-500">
            {students.length}s • {attendanceDates.length}d
          </div>
        </div>
        <p className="text-xs text-gray-600">
          Student names in first column, attendance days as columns, summary with stats in last column
        </p>
      </div>

      {/* Add New Attendance */}
      <div className="card p-3">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="input text-xs flex-1"
            />
            <button
              onClick={() => setShowAddAttendance(!showAddAttendance)}
              className="btn-primary text-xs px-3 py-2"
            >
              {showAddAttendance ? 'Cancel' : 'Add New'}
            </button>
          </div>
          {showAddAttendance && (
            <button
              onClick={handleAddNewAttendance}
              disabled={isSubmitting}
              className="btn-success text-xs flex items-center justify-center gap-2 py-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3 h-3 loading-spinner"></div>
                  Adding...
                </>
              ) : (
                <>
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add for {formatDate(selectedDate)}
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="card p-4 bg-red-50 border border-red-200">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-red-700 font-medium">{error}</p>
          </div>
        </div>
      )}

      {success && (
        <div className="card p-4 bg-green-50 border border-green-200">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <p className="text-green-700 font-medium">{success}</p>
          </div>
        </div>
      )}

      {/* Attendance Grid */}
      {attendanceDates.length === 0 ? (
            <div className="card p-6 text-center">
          <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
          <h3 className="text-base font-bold text-gray-900 mb-2">No Attendance Records</h3>
          <p className="text-sm text-gray-600 mb-4">No attendance has been taken yet for this class.</p>
          <button
            onClick={() => setShowAddAttendance(true)}
            className="btn-primary text-sm"
          >
            Take First Attendance
          </button>
            </div>
          ) : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-700 border-b border-gray-200 sticky left-0 bg-gray-50 z-10 min-w-[120px]">
                    Student
                  </th>
                  {attendanceDates.map(date => (
                    <th key={date} className="px-1 py-2 text-center text-xs font-medium text-gray-700 border-b border-gray-200 min-w-[60px]">
                      <div className="flex flex-col items-center">
                        <span className="text-xs text-gray-500">{formatDate(date)}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {students.map(student => (
                  <tr key={student.id} className="hover:bg-gray-50">
                    <td className="px-2 py-2 sticky left-0 bg-white z-10 border-r border-gray-200">
                      <div className="flex flex-col">
                        <div className="font-medium text-gray-900 text-xs truncate">{student.name}</div>
                        <div className="text-xs text-gray-500 truncate">@{student.username}</div>
                        {student.code && (
                          <div className="text-xs text-gray-400 truncate">{student.code}</div>
                        )}
                        {(() => {
                          const stats = getStudentAttendanceStats(student.id);
                          return (
                            <div className="mt-1 text-xs">
                              <div className="font-semibold text-gray-700">{stats.percentage}%</div>
                              <div className="flex space-x-1">
                                <span className="text-green-600" title="Present">P:{stats.present}</span>
                                <span className="text-blue-600" title="Excused">E:{stats.excused}</span>
                                <span className="text-yellow-600" title="Late">L:{stats.late}</span>
                                <span className="text-red-600" title="Absent">A:{stats.absent}</span>
                              </div>
                            </div>
                          );
                        })()}
            </div>
                    </td>
                    {attendanceDates.map(date => {
                      const status = getAttendanceForStudent(student.id, date);
                      const isEditing = editingCell === `${student.id}-${date}`;
                      
                      return (
                        <td key={date} className="px-1 py-1 text-center border-r border-gray-100">
                          {isEditing ? (
                            <select
                              value={status}
                              onChange={(e) => handleAttendanceChange(student.id, date, e.target.value)}
                              onBlur={() => setEditingCell(null)}
                              className="w-full text-xs border border-gray-300 rounded px-1 py-1 focus:outline-none focus:ring-1 focus:ring-primary-500"
                              autoFocus
                            >
                              <option value="">-</option>
                              <option value="present">P</option>
                              <option value="absent">A</option>
                              <option value="late">L</option>
                              <option value="excused">E</option>
                            </select>
                          ) : (
                            <button
                              onClick={() => setEditingCell(`${student.id}-${date}`)}
                              className={`w-full px-1 py-1 text-xs rounded border transition-colors ${
                                status 
                                  ? getStatusColor(status)
                                  : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                              }`}
                              disabled={isSubmitting}
                            >
                              {status ? (
                                <span className="flex items-center justify-center">
                                  <span className="text-xs font-bold">
                                    {status === 'present' ? 'P' : 
                                     status === 'absent' ? 'A' : 
                                     status === 'late' ? 'L' : 
                                     status === 'excused' ? 'E' : '?'}
                                  </span>
                                </span>
                              ) : (
                                <span className="text-gray-400 text-xs">-</span>
                              )}
                            </button>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {isSubmitting && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 flex items-center gap-3">
            <div className="w-6 h-6 loading-spinner"></div>
            <span className="text-gray-700">Saving attendance...</span>
          </div>
        </div>
      )}
    </div>
  );
}