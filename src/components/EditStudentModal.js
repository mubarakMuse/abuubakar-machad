import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function EditStudentModal({ isOpen, onClose, student, onStudentUpdated }) {
  const [editData, setEditData] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (student && isOpen) {
      setEditData({
        name: student.name || '',
        username: student.username || '',
        email: student.email || '',
        code: student.code || '',
        phone_number: student.phone_number || '',
        parent1_number: student.parent1_number || '',
        parent2_number: student.parent2_number || ''
      });
      setError(null);
    }
  }, [student, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!student) return;

    setIsSubmitting(true);
    setError(null);

    try {
      // Clean the data - convert empty strings to null
      const cleanedData = {
        ...editData,
        phone_number: editData.phone_number || null,
        parent1_number: editData.parent1_number || null,
        parent2_number: editData.parent2_number || null,
        code: editData.code || null
      };

      const { error } = await supabase
        .from('users')
        .update(cleanedData)
        .eq('id', student.id);

      if (error) throw error;

      onStudentUpdated();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field, value) => {
    setEditData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  if (!isOpen || !student) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-neutral-900">Edit Student</h3>
            <button
              onClick={onClose}
              className="text-neutral-400 hover:text-neutral-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">Name *</label>
              <input
                type="text"
                value={editData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Enter student's full name"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">Username *</label>
              <input
                type="text"
                value={editData.username}
                onChange={(e) => handleInputChange('username', e.target.value)}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Enter username"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">Email</label>
              <input
                type="email"
                value={editData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Enter email address"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">Student Code</label>
              <input
                type="text"
                value={editData.code}
                onChange={(e) => handleInputChange('code', e.target.value)}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Enter student code"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">Personal Phone Number</label>
              <input
                type="tel"
                value={editData.phone_number}
                onChange={(e) => handleInputChange('phone_number', e.target.value)}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Enter student's personal phone number"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">Parent 1 Phone Number</label>
              <input
                type="tel"
                value={editData.parent1_number}
                onChange={(e) => handleInputChange('parent1_number', e.target.value)}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Enter parent 1 phone number"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">Parent 2 Phone Number</label>
              <input
                type="tel"
                value={editData.parent2_number}
                onChange={(e) => handleInputChange('parent2_number', e.target.value)}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Enter parent 2 phone number"
              />
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block mr-2"></div>
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
