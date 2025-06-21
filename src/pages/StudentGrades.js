import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function StudentGrades({ studentId, levelId }) {
  const [grades, setGrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [average, setAverage] = useState(null);

  useEffect(() => {
    const fetchGrades = async () => {
      setLoading(true);
      
      const { data } = await supabase
        .from('grades')
        .select('score, assignment:assignments(title, max_score, category:grade_categories(name, weight))')
        .eq('student_id', studentId)
        .eq('assignment.level_id', levelId);
      
      if (data) {
        setGrades(data);
        
        // Calculate average
        if (data.length > 0) {
          const total = data.reduce((sum, grade) => sum + (grade.score / grade.assignment.max_score), 0);
          setAverage((total / data.length * 100).toFixed(1));
        }
      }
      
      setLoading(false);
    };
    
    fetchGrades();
  }, [studentId, levelId]);

  if (loading) return <div>Loading grades...</div>;

  return (
    <div className="bg-white shadow rounded-lg overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-medium leading-6 text-gray-900">Grades</h3>
        {average && (
          <p className="mt-1 text-sm text-gray-600">
            Current Average: <span className="font-bold">{average}%</span>
          </p>
        )}
      </div>
      
      <div className="divide-y divide-gray-200">
        {grades.length === 0 ? (
          <div className="px-6 py-4 text-center text-gray-500">
            No grades recorded yet
          </div>
        ) : (
          grades.map(grade => (
            <div key={grade.assignment.title} className="px-6 py-4">
              <div className="flex justify-between">
                <div>
                  <h4 className="font-medium">{grade.assignment.title}</h4>
                  {grade.assignment.category && (
                    <span className="text-xs text-gray-500">
                      {grade.assignment.category.name} ({grade.assignment.category.weight * 100}%)
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <span className="font-medium">
                    {grade.score}/{grade.assignment.max_score}
                  </span>
                  <span className={`block text-sm ${
                    (grade.score / grade.assignment.max_score * 100) >= 70 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {((grade.score / grade.assignment.max_score) * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}