// src/components/StudentList.jsx
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function StudentList({ levelCode }) {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        setLoading(true);
        
        // Fetch enrolled students for this level
        const { data, error } = await supabase
          .from('student_enrollment')
          .select(`
            student:users(
              id,
              username,
              name,
              code,
              created_at
            )
          `)
          .eq('level_code', levelCode)
          .order('enrolled_at', { ascending: true });

        if (error) throw error;

        setStudents(data.map(item => item.student));
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchStudents();
  }, [levelCode]);

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded mb-4">
        <p className="text-red-700">Error loading students: {error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-medium text-gray-900 mb-2">Students in this Class</h3>
      
      {students.length === 0 ? (
        <p className="text-gray-500">No students enrolled yet</p>
      ) : (
        <ul className="divide-y divide-gray-200">
          {students.map(student => (
            <li key={student.id} className="py-3 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center">
                  <span className="text-indigo-600 font-medium">
                    {student.name.charAt(0)}
                  </span>
                </div>
                <div>
                  <p className="font-medium text-gray-900">{student.name}</p>
                  <p className="text-sm text-gray-500">@{student.username}</p>
                </div>
              </div>
              <span className="text-xs bg-indigo-100 text-indigo-800 px-2 py-1 rounded-full relative group">
                <span className="blur-sm">{student.code}</span>
                <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  {student.code}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}