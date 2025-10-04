import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useParams } from 'react-router-dom';

export default function Gradebook({  }) {
    const { levelCode } = useParams();

  const [assignments, setAssignments] = useState([]);
  const [students, setStudents] = useState([]);
  const [grades, setGrades] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      
      // Fetch assignments
      const { data: assignmentsData } = await supabase
        .from('assignments')
        .select('*')
        .eq('level_code', levelCode)
        .order('due_date', { ascending: true, nullsLast: true });
      
      // Fetch students
      const { data: studentsData } = await supabase
        .from('student_enrollment')
        .select('student:users(id, name, username)')
        .eq('level_code', levelCode);
      
      // Fetch grades
      const { data: gradesData } = await supabase
        .from('grades')
        .select('*');
      
      // Transform grades into { assignmentId: { studentId: grade } }
      const gradesMap = {};
      gradesData?.forEach(grade => {
        if (!gradesMap[grade.assignment_id]) {
          gradesMap[grade.assignment_id] = {};
        }
        gradesMap[grade.assignment_id][grade.student_id] = grade;
      });
      
      setAssignments(assignmentsData || []);
      setStudents(studentsData?.map(item => item.student) || []);
      setGrades(gradesMap);
      setLoading(false);
    };
    
    fetchData();
  }, [levelCode]);

  const handleGradeChange = async (assignmentId, studentId, score) => {
    const numericScore = parseFloat(score);
    if (isNaN(numericScore)) return;
    
    try {
      // Check if grade exists
      const existingGrade = grades[assignmentId]?.[studentId];
      
      if (existingGrade) {
        // Update existing grade
        const { error } = await supabase
          .from('grades')
          .update({ score: numericScore })
          .eq('id', existingGrade.id);
        
        if (!error) {
          setGrades(prev => ({
            ...prev,
            [assignmentId]: {
              ...prev[assignmentId],
              [studentId]: { ...prev[assignmentId][studentId], score: numericScore }
            }
          }));
        }
      } else {
        // Create new grade
        const assignment = assignments.find(a => a.id === assignmentId);
        const { data, error } = await supabase
          .from('grades')
          .insert([{
            assignment_id: assignmentId,
            student_id: studentId,
            score: numericScore
          }])
          .select();
        
        if (!error) {
          setGrades(prev => ({
            ...prev,
            [assignmentId]: {
              ...prev[assignmentId],
              [studentId]: data[0]
            }
          }));
        }
      }
    } catch (err) {
      console.error('Error saving grade:', err);
    }
  };

  if (loading) return <div>Loading gradebook...</div>;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Student
            </th>
            {assignments.map(assignment => (
              <th key={assignment.id} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {assignment.title}
                <div className="text-xs text-gray-400">{assignment.max_score} pts</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {students.map(student => (
            <tr key={student.id}>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm font-medium text-gray-900">{student.name}</div>
                <div className="text-sm text-gray-500">@{student.username}</div>
              </td>
              {assignments.map(assignment => {
                const grade = grades[assignment.id]?.[student.id];
                const percentage = grade ? (grade.score / assignment.max_score * 100).toFixed(1) : null;
                
                return (
                  <td key={`${student.id}-${assignment.id}`} className="px-6 py-4 whitespace-nowrap">
                    <input
                      type="number"
                      min="0"
                      max={assignment.max_score}
                      step="0.01"
                      value={grade?.score || ''}
                      onChange={(e) => handleGradeChange(assignment.id, student.id, e.target.value)}
                      className="w-20 border rounded px-2 py-1"
                      placeholder="0"
                    />
                    {percentage && (
                      <div className={`text-xs mt-1 ${
                        percentage >= 90 ? 'text-green-600' :
                        percentage >= 70 ? 'text-blue-600' :
                        percentage >= 50 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {percentage}%
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}