import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import { supabase } from '../lib/supabase';

export default function AnnouncementsTab({ levelCode, teacherId }) {
  const [announcements, setAnnouncements] = useState([]);
  const [showAnnouncementForm, setShowAnnouncementForm] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState(null);
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingField, setEditingField] = useState(null); // Track which field is being edited

  useEffect(() => {
    fetchAnnouncements();
  }, [levelCode]);

  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('updates')
        .select('*')
        .eq('level_code', levelCode)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAnnouncements(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAnnouncementSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      if (editingAnnouncement) {
        const { error } = await supabase
          .from('updates')
          .update({
            title: title,
            content: content,
          })
          .eq('id', editingAnnouncement.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('updates')
          .insert([{
            title: title,
            content: content,
            level_code: levelCode,
            teacher_id: teacherId,
            created_at: new Date().toISOString()
          }]);

        if (error) throw error;
      }

      setTitle('');
      setContent('');
      setShowAnnouncementForm(false);
      setEditingAnnouncement(null);
      fetchAnnouncements();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAnnouncement = async (id) => {
    if (window.confirm('Are you sure you want to delete this announcement?')) {
      try {
        const { error } = await supabase
          .from('updates')
          .delete()
          .eq('id', id);

        if (error) throw error;
        fetchAnnouncements();
      } catch (err) {
        setError(err.message);
      }
    }
  };

  const startEditingAnnouncement = (announcement) => {
    setEditingAnnouncement(announcement);
    setTitle(announcement.title);
    setContent(announcement.content);
    setShowAnnouncementForm(true);
  };

  const handleInlineEdit = async (announcementId, field, value) => {
    try {
      const { error } = await supabase
        .from('updates')
        .update({ [field]: value })
        .eq('id', announcementId);

      if (error) throw error;
      
      // Update local state
      setAnnouncements(announcements.map(announcement => 
        announcement.id === announcementId 
          ? { ...announcement, [field]: value }
          : announcement
      ));
    } catch (err) {
      setError(err.message);
    }
  };

  const startInlineEdit = (announcementId, field) => {
    setEditingField(`${announcementId}-${field}`);
  };

  const cancelInlineEdit = () => {
    setEditingField(null);
  };

  const saveInlineEdit = async (announcementId, field, value) => {
    if (value && value.trim() !== '') {
      await handleInlineEdit(announcementId, field, value.trim());
    }
    setEditingField(null);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 loading-spinner"></div>
          <p className="text-neutral-600">Loading announcements...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gradient">Announcements</h2>
          <p className="text-neutral-600 mt-1">Share updates and important information with your class</p>
        </div>
        
        <button
          onClick={() => {
            setEditingAnnouncement(null);
            setTitle('');
            setContent('');
            setShowAnnouncementForm(true);
          }}
          className="btn-primary px-4 py-2 text-sm font-semibold"
        >
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          New Announcement
        </button>
      </div>

      {error && (
        <div className="card p-4 border-l-4 border-error-500 bg-error-50">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-error-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-error-700 font-medium">{error}</p>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {announcements.length === 0 ? (
          <div className="card p-8 text-center">
            <div className="w-16 h-16 bg-neutral-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-neutral-900 mb-2">No announcements yet</h3>
            <p className="text-neutral-500">Create your first announcement to share updates with your class.</p>
          </div>
        ) : (
          announcements.map((announcement, index) => (
            <div key={announcement.id} className="card p-6 animate-slide-up" style={{ animationDelay: `${index * 100}ms` }}>
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  {editingField === `${announcement.id}-title` ? (
                    <input
                      type="text"
                      defaultValue={announcement.title}
                      className="w-full text-lg font-bold text-neutral-900 bg-transparent border-b border-primary-500 focus:outline-none focus:border-primary-600"
                      onBlur={(e) => saveInlineEdit(announcement.id, 'title', e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.target.blur();
                        } else if (e.key === 'Escape') {
                          cancelInlineEdit();
                        }
                      }}
                      autoFocus
                    />
                  ) : (
                    <h3 
                      className="text-lg font-bold text-neutral-900 cursor-pointer hover:bg-neutral-50 p-2 rounded-lg transition-colors duration-200"
                      onClick={() => startInlineEdit(announcement.id, 'title')}
                    >
                      {announcement.title}
                    </h3>
                  )}
                  <p className="text-sm text-neutral-500 mt-1">
                    Posted: {new Date(announcement.created_at).toLocaleString()}
                  </p>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => startEditingAnnouncement(announcement)}
                    className="btn-secondary text-sm px-3 py-2"
                  >
                    Edit Full
                  </button>
                  <button
                    onClick={() => handleDeleteAnnouncement(announcement.id)}
                    className="btn-ghost text-error-600 hover:text-error-700 text-sm px-3 py-2"
                  >
                    Delete
                  </button>
                </div>
              </div>
              
              <div className="prose prose-sm max-w-none">
                {editingField === `${announcement.id}-content` ? (
                  <textarea
                    defaultValue={announcement.content}
                    className="w-full p-3 border border-primary-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                    rows={6}
                    onBlur={(e) => saveInlineEdit(announcement.id, 'content', e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Escape') {
                        cancelInlineEdit();
                      }
                    }}
                    autoFocus
                  />
                ) : (
                  <div 
                    className="cursor-pointer hover:bg-neutral-50 p-3 rounded-lg transition-colors duration-200"
                    onClick={() => startInlineEdit(announcement.id, 'content')}
                  >
                    <ReactMarkdown rehypePlugins={[rehypeSanitize]}>
                      {announcement.content}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Announcement Form Modal */}
      {showAnnouncementForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 safe-top safe-bottom">
          <div className="bg-white rounded-3xl shadow-large w-full max-w-2xl p-8 animate-scale-in">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-neutral-900">
                {editingAnnouncement ? 'Edit Announcement' : 'New Announcement'}
              </h3>
              <button
                onClick={() => {
                  setShowAnnouncementForm(false);
                  setEditingAnnouncement(null);
                  setTitle('');
                  setContent('');
                }}
                className="p-2 hover:bg-neutral-100 rounded-xl transition-colors duration-200"
              >
                <svg className="w-5 h-5 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

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

            <form onSubmit={handleAnnouncementSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="input"
                  placeholder="Enter the title of the announcement"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">Content</label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="input"
                  rows={6}
                  placeholder="What's new in class today?"
                  required
                />
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowAnnouncementForm(false);
                    setEditingAnnouncement(null);
                    setTitle('');
                    setContent('');
                  }}
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
                      {editingAnnouncement ? 'Updating...' : 'Posting...'}
                    </>
                  ) : (
                    editingAnnouncement ? 'Update Announcement' : 'Post Announcement'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
