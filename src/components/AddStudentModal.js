import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function AddStudentModal({ isOpen, onClose, levelCode, onStudentAdded }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [existingStudents, setExistingStudents] = useState([]);
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [newStudent, setNewStudent] = useState({
    name: '',
    username: '',
    email: '',
    code: '',
    phone_number: '',
    parent1_number: '',
    parent2_number: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [mode, setMode] = useState('existing'); // 'existing' or 'new'
  const [enrolledStudentIds, setEnrolledStudentIds] = useState([]);

  useEffect(() => {
    if (isOpen) {
      fetchExistingStudents();
      fetchEnrolledStudents();
    }
  }, [isOpen, levelCode]);

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredStudents(existingStudents);
    } else {
      const filtered = existingStudents.filter(student => 
        student.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.code?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredStudents(filtered);
    }
  }, [searchTerm, existingStudents]);

  const fetchExistingStudents = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, username, email, code, role')
        .eq('role', 'student')
        .order('name', { ascending: true });

      if (error) throw error;
      setExistingStudents(data || []);
    } catch (err) {
      setError(err.message);
    }
  };

  const fetchEnrolledStudents = async () => {
    try {
      const { data, error } = await supabase
        .from('student_enrollment')
        .select('student_id')
        .eq('level_code', levelCode);

      if (error) throw error;
      setEnrolledStudentIds(data?.map(item => item.student_id) || []);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleStudentSelect = (student) => {
    if (selectedStudents.find(s => s.id === student.id)) {
      setSelectedStudents(selectedStudents.filter(s => s.id !== student.id));
    } else {
      setSelectedStudents([...selectedStudents, student]);
    }
  };

  const handleAddExistingStudents = async () => {
    if (selectedStudents.length === 0) return;

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const enrollments = selectedStudents.map(student => ({
        student_id: student.id,
        level_code: levelCode,
        enrolled_at: new Date().toISOString()
      }));

      const { error } = await supabase
        .from('student_enrollment')
        .insert(enrollments);

      if (error) throw error;

      setSuccess(`Successfully added ${selectedStudents.length} student(s) to the class!`);
      setSelectedStudents([]);
      setSearchTerm('');
      onStudentAdded();
      
      // Close modal after a short delay
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddNewStudent = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      // First create the new student
      const { data: newStudentData, error: createError } = await supabase
        .from('users')
        .insert([{
          name: newStudent.name,
          username: newStudent.username,
          email: newStudent.email,
          code: newStudent.code,
          phone_number: newStudent.phone_number || null,
          parent1_number: newStudent.parent1_number || null,
          parent2_number: newStudent.parent2_number || null,
          role: 'student',
          created_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (createError) throw createError;

      // Then enroll them in the level
      const { error: enrollError } = await supabase
        .from('student_enrollment')
        .insert([{
          student_id: newStudentData.id,
          level_code: levelCode,
          enrolled_at: new Date().toISOString()
        }]);

      if (enrollError) throw enrollError;

      setSuccess(`Successfully created and added ${newStudent.name} to the class!`);
      setNewStudent({ name: '', username: '', email: '', code: '', phone_number: '', parent1_number: '', parent2_number: '' });
      onStudentAdded();
      
      // Close modal after a short delay
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isStudentEnrolled = (studentId) => {
    return enrolledStudentIds.includes(studentId);
  };

  const isStudentSelected = (studentId) => {
    return selectedStudents.find(s => s.id === studentId);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 safe-top safe-bottom">
      <div className="bg-white rounded-3xl shadow-large w-full max-w-4xl max-h-[90vh] overflow-hidden animate-scale-in">
        <div className="flex items-center justify-between p-6 border-b border-neutral-200">
          <h3 className="text-xl font-bold text-neutral-900">Add Students to Class</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-neutral-100 rounded-xl transition-colors duration-200"
          >
            <svg className="w-5 h-5 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {/* Mode Toggle */}
          <div className="flex items-center space-x-1 bg-neutral-100 p-1 rounded-xl mb-6">
            <button
              onClick={() => setMode('existing')}
              className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                mode === 'existing'
                  ? 'bg-white text-primary-600 shadow-soft'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Add Existing Students
            </button>
            <button
              onClick={() => setMode('new')}
              className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                mode === 'new'
                  ? 'bg-white text-primary-600 shadow-soft'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Create New Student
            </button>
          </div>

          {/* Error/Success Messages */}
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

          {success && (
            <div className="mb-6 p-4 bg-success-50 border border-success-200 rounded-2xl">
              <div className="flex items-center gap-3">
                <svg className="h-5 w-5 text-success-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <p className="text-success-700 font-medium">{success}</p>
              </div>
            </div>
          )}

          {mode === 'existing' ? (
            <div className="space-y-4">
              {/* Search */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search students by name, username, email, or code..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full input pl-10"
                />
                <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>

              {/* Selected Students Count */}
              {selectedStudents.length > 0 && (
                <div className="p-3 bg-primary-50 rounded-lg">
                  <p className="text-sm text-primary-700">
                    {selectedStudents.length} student(s) selected
                  </p>
                </div>
              )}

              {/* Students List */}
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredStudents.map((student) => (
                  <div
                    key={student.id}
                    className={`p-4 rounded-2xl border-2 cursor-pointer transition-all duration-200 ${
                      isStudentSelected(student.id)
                        ? 'border-primary-500 bg-primary-50'
                        : isStudentEnrolled(student.id)
                        ? 'border-neutral-200 bg-neutral-50 cursor-not-allowed opacity-60'
                        : 'border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50'
                    }`}
                    onClick={() => !isStudentEnrolled(student.id) && handleStudentSelect(student)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-xl flex items-center justify-center">
                          <span className="text-white font-bold text-sm">
                            {student.name?.charAt(0)?.toUpperCase() || '?'}
                          </span>
                        </div>
                        <div>
                          <h4 className="font-medium text-neutral-900">{student.name || 'No name'}</h4>
                          <p className="text-sm text-neutral-500">@{student.username || 'No username'}</p>
                          {student.email && (
                            <p className="text-xs text-neutral-400">{student.email}</p>
                          )}
                          {student.code && (
                            <p className="text-xs text-neutral-400">Code: {student.code}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isStudentEnrolled(student.id) ? (
                          <span className="px-2 py-1 bg-success-100 text-success-700 rounded-lg text-xs font-medium">
                            Already Enrolled
                          </span>
                        ) : isStudentSelected(student.id) ? (
                          <div className="w-6 h-6 bg-primary-500 rounded-full flex items-center justify-center">
                            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        ) : (
                          <div className="w-6 h-6 border-2 border-neutral-300 rounded-full"></div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add Selected Button */}
              <div className="flex justify-end">
                <button
                  onClick={handleAddExistingStudents}
                  disabled={selectedStudents.length === 0 || isSubmitting}
                  className="btn-primary"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 loading-spinner mr-2"></div>
                      Adding...
                    </>
                  ) : (
                    `Add ${selectedStudents.length} Student(s)`
                  )}
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleAddNewStudent} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">Name *</label>
                  <input
                    type="text"
                    value={newStudent.name}
                    onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })}
                    className="input"
                    placeholder="Enter student's full name"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">Username *</label>
                  <input
                    type="text"
                    value={newStudent.username}
                    onChange={(e) => setNewStudent({ ...newStudent, username: e.target.value })}
                    className="input"
                    placeholder="Enter username"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">Email</label>
                  <input
                    type="email"
                    value={newStudent.email}
                    onChange={(e) => setNewStudent({ ...newStudent, email: e.target.value })}
                    className="input"
                    placeholder="Enter email address"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">Student Code</label>
                  <input
                    type="text"
                    value={newStudent.code}
                    onChange={(e) => setNewStudent({ ...newStudent, code: e.target.value })}
                    className="input"
                    placeholder="Enter student code"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">Personal Phone Number</label>
                  <input
                    type="tel"
                    value={newStudent.phone_number}
                    onChange={(e) => setNewStudent({ ...newStudent, phone_number: e.target.value })}
                    className="input"
                    placeholder="Enter student's personal phone number"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">Parent 1 Phone Number</label>
                  <input
                    type="tel"
                    value={newStudent.parent1_number}
                    onChange={(e) => setNewStudent({ ...newStudent, parent1_number: e.target.value })}
                    className="input"
                    placeholder="Enter parent 1 phone number"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">Parent 2 Phone Number</label>
                  <input
                    type="tel"
                    value={newStudent.parent2_number}
                    onChange={(e) => setNewStudent({ ...newStudent, parent2_number: e.target.value })}
                    className="input"
                    placeholder="Enter parent 2 phone number"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={onClose}
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
                      Creating...
                    </>
                  ) : (
                    'Create & Add Student'
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
