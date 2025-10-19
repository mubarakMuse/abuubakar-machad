import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LevelPage from './pages/LevelPage';
import TeacherUpdateForm from './pages/TeacherUpdateForm';
import HomePage from './pages/HomePage';
import Gradebook from './pages/Gradebook';
import TeacherDashboard from './pages/TeacherDashboard';
import AdminPage from './pages/AdminPage';
import ParentLookup from './pages/ParentLookup';
import AuthWrapper from './components/AuthWrapper';

function App() {
  return (
    <Router>
      <Routes>
        {/* Public routes - no authentication required */}
        <Route path="/parent" element={<ParentLookup />} />
        
        {/* Protected routes - require authentication */}
        <Route path="/*" element={
          <AuthWrapper>
            <Routes>
              <Route path="/level/:levelCode" element={<LevelPage />} />
              <Route path="/level/:levelCode/update" element={<TeacherDashboard />} />
              <Route path="/level/:levelCode/grade" element={<Gradebook />} />
              <Route path="/teacher" element={<TeacherDashboard />} />
              <Route path="/admin" element={<AdminPage />} />
              <Route path="/" element={<HomePage />} />
            </Routes>
          </AuthWrapper>
        } />
      </Routes>
    </Router>
  );
}

export default App;
