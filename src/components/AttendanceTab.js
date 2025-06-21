import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function AttendanceTab({ levelCode }) {
  const [attendance, setAttendance] = useState([]);
  const [showAttendanceForm, setShowAttendanceForm] = useState(false);
  const [showBulkAttendanceModal, setShowBulkAttendanceModal] = useState(false);
  const [enrolledStudents, setEnrolledStudents] = useState([]);
  const [bulkAttendance, setBulkAttendance] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [editingAttendance, setEditingAttendance] = useState(null);

  useEffect(() => {
    fetchAttendance();
    fetchEnrolledStudents();
  }, [levelCode, selectedDate]);

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

      // Update local state
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

  const getStatusColor = (status) => {
    switch (status) {
      case 'present':
        return 'bg-green-100 text-green-800';
      case 'absent':
        return 'bg-red-100 text-red-800';
      case 'late':
        return 'bg-yellow-100 text-yellow-800';
      case 'excused':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const renderAttendanceCard = (record) => (
    <div key={record.id} className="bg-white rounded-2xl shadow-lg p-6 border border-indigo-100">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-bold text-gray-900">{record.student.name}</h3>
          <p className="text-sm text-gray-500">@{record.student.username}</p>
        </div>
        <div className="flex items-center space-x-4">
          {editingAttendance === record.id ? (
            <div className="flex items-center space-x-4">
              <select
                value={record.status}
                onChange={(e) => handleIndividualAttendanceUpdate(record.id, e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                disabled={isSubmitting}
              >
                <option value="present">Present</option>
                <option value="absent">Absent</option>
                <option value="late">Late</option>
                <option value="excused">Excused</option>
              </select>
              <button
                onClick={() => setEditingAttendance(null)}
                className="text-gray-500 hover:text-gray-700"
                disabled={isSubmitting}
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ) : (
            <>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(record.status)}`}>
                {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
              </span>
              <button
                onClick={() => setEditingAttendance(record.id)}
                className="text-indigo-600 hover:text-indigo-800"
                disabled={isSubmitting}
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );

  const renderBulkAttendanceModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-lg p-8 border border-indigo-100 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Take Attendance - {selectedDate}
          </h3>
          <button
            onClick={() => {
              setShowBulkAttendanceModal(false);
              setBulkAttendance({});
            }}
            className="text-gray-500 hover:text-gray-700"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleBulkAttendanceSubmit} className="space-y-6">
          <div className="space-y-4">
            {enrolledStudents.map((student) => (
              <div key={student.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <h4 className="font-medium text-gray-900">{student.name}</h4>
                  <p className="text-sm text-gray-500">@{student.username}</p>
                </div>
                <div className="flex items-center space-x-4">
                  <select
                    value={bulkAttendance[student.id] || ''}
                    onChange={(e) => setBulkAttendance({
                      ...bulkAttendance,
                      [student.id]: e.target.value
                    })}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Select Status</option>
                    <option value="present">Present</option>
                    <option value="absent">Absent</option>
                    <option value="late">Late</option>
                    <option value="excused">Excused</option>
                  </select>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-4 pt-4">
            <button
              type="button"
              onClick={() => {
                setShowBulkAttendanceModal(false);
                setBulkAttendance({});
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
              ) : 'Save Attendance'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
          Attendance
        </h2>
        <div className="flex items-center space-x-4">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            onClick={() => {
              setShowBulkAttendanceModal(true);
              fetchEnrolledStudents();
            }}
            className="px-6 py-3 rounded-lg text-white font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 ease-in-out"
          >
            Take Attendance
          </button>
        </div>
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
        {attendance.map(renderAttendanceCard)}
      </div>

      {showBulkAttendanceModal && renderBulkAttendanceModal()}
    </div>
  );
}
