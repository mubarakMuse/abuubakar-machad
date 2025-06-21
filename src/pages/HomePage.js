import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function HomePage() {
  const [levels, setLevels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchLevels = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('levels')
          .select('*')
          .order('name', { ascending: true });

        if (error) throw error;
        setLevels(data || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchLevels();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-4">
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4">
          <p>Error loading levels: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-extrabold text-gray-900 sm:text-5xl mb-4">
             Abubakar Islamic Institute Student Portal
          </h1>
         
          <button
            onClick={() => navigate('/student')}
            className="mt-8 inline-block px-8 py-3 bg-blue-600 text-white text-lg font-semibold rounded-lg shadow hover:bg-blue-700 transition"
          >
            Go to Student Dashboard
          </button>
        </div>

        {/* Classroom Levels Section */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">
            Classroom Levels
          </h2>
          <p className="mb-8 text-center text-gray-500">
            Select a level to view or post updates
          </p>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {levels.map((level) => (
              <div 
                key={level.id}
                onClick={() => navigate(`/level/${level.code}`)}
                className="bg-white overflow-hidden shadow rounded-lg cursor-pointer transition-all hover:shadow-lg hover:-translate-y-1"
              >
                <div className="px-4 py-5 sm:p-6 flex justify-between items-center">
                  <div>
                    <h3 className="text-lg leading-6 font-medium text-gray-900">
                      {level.name}
                    </h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Level: {level.level || 'N/A'}
                    </p>
                  </div>
                  <div className="text-gray-400">
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      className="h-6 w-6" 
                      fill="none" 
                      viewBox="0 0 24 24" 
                      stroke="currentColor"
                    >
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth={2} 
                        d="M9 5l7 7-7 7" 
                      />
                    </svg>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {levels.length === 0 && (
            <div className="text-center py-12">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1"
                  d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <h3 className="mt-2 text-lg font-medium text-gray-900">No levels found</h3>
              <p className="mt-1 text-gray-500">No classroom levels have been created yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}