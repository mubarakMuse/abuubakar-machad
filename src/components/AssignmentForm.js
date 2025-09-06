import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function AssignmentForm({ levelCode, teacherId, onAssignmentCreated }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [maxScore, setMaxScore] = useState(100);
  const [dueDate, setDueDate] = useState('');
  const [categoryId, setCategoryId] = useState(null);
  const [categories, setCategories] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    const fetchCategories = async () => {
      const { data, error } = await supabase
        .from('grade_categories')
        .select('*')
        .eq('level_code', levelCode);
      
      if (!error) setCategories(data);
    };
    fetchCategories();
  }, [levelCode]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    
    try {
      const { data, error } = await supabase
        .from('assignments')
        .insert([{
          level_code: levelCode,
          teacher_id: teacherId,
          title,
          description,
          max_score: maxScore,
          due_date: dueDate || null,
          category_id: categoryId || null
        }])
        .select();
      
      if (error) throw error;
      
      onAssignmentCreated(data[0]);
      // Reset form
      setTitle('');
      setDescription('');
      setMaxScore(100);
      setDueDate('');
      setCategoryId(null);
      setShowForm(false);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setMaxScore(100);
    setDueDate('');
    setCategoryId(null);
    setError(null);
    setShowForm(false);
  };

  if (!showForm) {
    return (
      <div className="card p-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-mobile-lg font-bold text-neutral-900">Create Assignment</h3>
            <p className="text-mobile-xs text-neutral-600 mt-1">Add a new assignment for your students</p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="btn-primary flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="hidden sm:inline">New Assignment</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card p-4 mb-6 animate-slide-up">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-mobile-lg font-bold text-neutral-900">Create New Assignment</h2>
        <button
          onClick={resetForm}
          className="btn-ghost p-1"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-error-50 border border-error-200 rounded-lg">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-error-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-mobile-xs text-error-700">{error}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-mobile-sm font-medium text-neutral-700 mb-1">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="input"
            placeholder="Enter assignment title"
            required
          />
        </div>
        
        <div>
          <label className="block text-mobile-sm font-medium text-neutral-700 mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="input resize-none"
            placeholder="Describe the assignment requirements..."
          />
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-mobile-sm font-medium text-neutral-700 mb-1">Max Score</label>
            <input
              type="number"
              min="1"
              step="0.01"
              value={maxScore}
              onChange={(e) => setMaxScore(parseFloat(e.target.value))}
              className="input"
              required
            />
          </div>
          
          <div>
            <label className="block text-mobile-sm font-medium text-neutral-700 mb-1">Due Date</label>
            <input
              type="datetime-local"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="input"
            />
          </div>
        </div>
        
        {categories.length > 0 && (
          <div>
            <label className="block text-mobile-sm font-medium text-neutral-700 mb-1">Category</label>
            <select
              value={categoryId || ''}
              onChange={(e) => setCategoryId(e.target.value ? parseInt(e.target.value) : null)}
              className="input"
            >
              <option value="">No Category</option>
              {categories.map(category => (
                <option key={category.id} value={category.id}>
                  {category.name} ({category.weight * 100}%)
                </option>
              ))}
            </select>
          </div>
        )}
        
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            type="button"
            onClick={resetForm}
            className="btn-secondary flex-1"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !title.trim()}
            className="btn-primary flex-1 flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 loading-spinner"></div>
                <span>Creating...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Create Assignment</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}