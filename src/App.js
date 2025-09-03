import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LevelPage from './pages/LevelPage';
import TeacherUpdateForm from './pages/TeacherUpdateForm';
import HomePage from './pages/HomePage';
import Gradebook from './pages/Gradebook';
import TeacherDashboard from './pages/TeacherDashboard';
import AuthWrapper from './components/AuthWrapper';

function App() {
  return (
    <Router>
      <AuthWrapper>
        <Routes>
          <Route path="/level/:levelCode" element={<LevelPage />} />
          <Route path="/level/:levelCode/update" element={<TeacherDashboard />} />
          <Route path="/level/:levelCode/grade" element={<Gradebook />} />
          <Route path="/teacher" element={<TeacherDashboard />} />
          <Route path="/" element={<HomePage />} />
        </Routes>
      </AuthWrapper>
    </Router>
  );
}

export default App;
