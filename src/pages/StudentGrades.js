import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function StudentGrades({ studentId, levelCode }) {
  const [grades, setGrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [average, setAverage] = useState(null);
  const [error, setError] = useState(null);

  const calculateLetter = (pct) => {
    if (pct >= 90) return 'A';
    if (pct >= 80) return 'B';
    if (pct >= 70) return 'C';
    if (pct >= 60) return 'D';
    return 'F';
  };

  useEffect(() => {
    const fetchGrades = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const { data, error } = await supabase
          .from('grades')
          .select('id, score, feedback, graded_at, assignment:assignments(title, max_score, level_code, category:grade_categories(name))')
          .eq('student_id', studentId)
          .eq('assignment.level_code', levelCode)
          .order('graded_at', { ascending: false });
        
        if (error) throw error;

        setGrades(data || []);

        if (data && data.length > 0) {
          const totalPct = data.reduce((sum, g) => {
            const pct = g.assignment?.max_score > 0 ? (g.score / g.assignment.max_score) * 100 : 0;
            return sum + pct;
          }, 0);
          setAverage((totalPct / data.length).toFixed(1));
        } else {
          setAverage(null);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (studentId && levelCode) {
      fetchGrades();
    }
  }, [studentId, levelCode]);

  if (loading) return (
    <div className="flex justify-center items-center p-6">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-600"></div>
    </div>
  );

  if (error) return (
    <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
      <p className="text-red-700">{error}</p>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-2xl font-bold text-gray-900">Your Grades for {levelCode}</h3>
        {average !== null && (
          <div className="flex items-center gap-3">
            <div className="text-sm text-gray-600">Average</div>
            <div className="px-3 py-1 rounded-full text-sm font-semibold bg-indigo-100 text-indigo-800">
              {average}% ({calculateLetter(parseFloat(average))})
            </div>
          </div>
        )}
      </div>

      {grades.length === 0 ? (
        <div className="bg-white rounded-xl p-6 shadow-md border border-indigo-100">
          <p className="text-gray-600">No grades available yet for this class.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <table className="min-w-full">
            <thead>
              <tr className="border-b-2 border-gray-200">
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Assignment</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Type</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Score</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Percentage</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Letter</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {grades.map(g => {
                const pct = g.assignment?.max_score > 0 ? Math.round((g.score / g.assignment.max_score) * 10000) / 100 : 0;
                const letter = calculateLetter(pct);
                return (
                  <tr key={g.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-gray-900">{g.assignment?.title}</td>
                    <td className="px-6 py-4 text-gray-900">{g.assignment?.category?.name || '-'}</td>
                    <td className="px-6 py-4 text-gray-900">{g.score} / {g.assignment?.max_score}</td>
                    <td className="px-6 py-4 text-gray-900">{pct}%</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                        letter === 'A' ? 'bg-green-100 text-green-800' :
                        letter === 'B' ? 'bg-blue-100 text-blue-800' :
                        letter === 'C' ? 'bg-yellow-100 text-yellow-800' :
                        letter === 'D' ? 'bg-orange-100 text-orange-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {letter}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-900">{new Date(g.graded_at).toLocaleDateString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}