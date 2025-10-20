import { useState } from 'react';
import { supabase } from '../lib/supabase';
import StudentReportCard from '../components/StudentReportCard';

export default function ParentLookup() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);

  // Function to extract only digits from phone number
  const extractDigits = (phoneNumber) => {
    return phoneNumber.replace(/\D/g, '');
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!phoneNumber.trim()) {
      setError('Please enter a phone number');
      return;
    }

    // Extract only digits from the input
    const digitsOnly = extractDigits(phoneNumber.trim());
    
    if (digitsOnly.length < 7) {
      setError('Please enter a valid phone number (at least 7 digits)');
      return;
    }

    setLoading(true);
    setError(null);
    setStudents([]);
    setSelectedStudent(null);

    try {
      // Search for students by parent phone numbers using only digits
      const { data, error } = await supabase
        .from('users')
        .select(`
          id,
          name,
          username,
          email,
          code,
          parent1_number,
          parent2_number
        `)
        .eq('role', 'student')
        .or(`parent1_number.ilike.%${digitsOnly}%,parent2_number.ilike.%${digitsOnly}%`);

      if (error) throw error;

      if (data && data.length > 0) {
        setStudents(data);
      } else {
        setError('No students found with that parent phone number');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStudentSelect = (student) => {
    setSelectedStudent(student);
  };

  const handleBackToSearch = () => {
    setSelectedStudent(null);
  };

  if (selectedStudent) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-bold text-gray-900">Student Report Card</h1>
              <button
                onClick={handleBackToSearch}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
              >
                ← Back to Search
              </button>
            </div>
            <StudentReportCard student={selectedStudent} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-md p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Parent Portal</h1>
            <p className="text-gray-600">Enter your phone number to view your child's report card</p>
          </div>

          <form onSubmit={handleSearch} className="space-y-6">
            <div>
              <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700 mb-2">
                Phone Number
              </label>
              <input
                type="tel"
                id="phoneNumber"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="Enter phone number (e.g., +1 (234) 567-8900 or 1234567890)"
                className="w-full px-4 py-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-lg"
                required
              />
              <p className="mt-2 text-sm text-gray-500">
                Only digits will be used for searching (spaces, dashes, and parentheses will be ignored)
              </p>
              {phoneNumber && (
                <p className="mt-1 text-sm text-indigo-600 font-medium">
                  Searching with: {extractDigits(phoneNumber) || 'No digits found'}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 text-white py-3 px-4 rounded-md hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Searching...' : 'Search for Students'}
            </button>
          </form>

          {error && (
            <div className="mt-6 bg-red-50 border-l-4 border-red-500 p-4 rounded">
              <p className="text-red-700">{error}</p>
            </div>
          )}

          {students.length > 0 && (
            <div className="mt-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Found {students.length} student{students.length > 1 ? 's' : ''}:
              </h2>
              <div className="space-y-3">
                {students.map((student) => (
                  <div
                    key={student.id}
                    className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => handleStudentSelect(student)}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-lg font-medium text-gray-900">{student.name}</h3>
                      </div>
                      <div className="text-indigo-600 font-medium">
                        View Report Card →
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
