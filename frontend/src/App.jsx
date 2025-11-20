import { Routes, Route, Navigate } from 'react-router-dom'
import Home from './pages/Home'
import Login from './pages/Login'
import Profile from './pages/Profile'
import Admin from './pages/Admin'
import TeacherDashboard from './pages/TeacherDashboard'
import CourseDetail from './pages/CourseDetail'
import LectureView from './pages/LectureView'
import ChangePassword from './pages/ChangePassword'
import { useAuth } from './hooks/useAuth'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/change_password" element={<ChangePassword />} />
      <Route 
        path="/profile" 
        element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/admin" 
        element={
          <AdminRoute>
            <Admin />
          </AdminRoute>
        } 
      />
      <Route 
        path="/dashboard" 
        element={
          <TeacherRoute>
            <TeacherDashboard />
          </TeacherRoute>
        } 
      />
      <Route 
        path="/course/:courseId" 
        element={
          <TeacherRoute>
            <CourseDetail />
          </TeacherRoute>
        } 
      />
      <Route 
        path="/course/:courseId/lecture/:lectureId" 
        element={
          <ProtectedRoute>
            <LectureView />
          </ProtectedRoute>
        } 
      />
    </Routes>
  )
}

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth()
  
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />
  }
  
  return children
}

function AdminRoute({ children }) {
  const { isAuthenticated, isAdmin } = useAuth()
  
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />
  }
  
  if (!isAdmin()) {
    return <Navigate to="/profile" replace />
  }
  
  return children
}

function TeacherRoute({ children }) {
  const { isAuthenticated, role } = useAuth()
  
  // Проверяем напрямую из localStorage, чтобы избежать редиректа при перезагрузке
  const token = localStorage.getItem('token')
  const storedRole = localStorage.getItem('role')
  
  if (!token) {
    return <Navigate to="/login" replace />
  }
  
  // Используем role из useAuth, если он есть, иначе из localStorage
  const currentRole = role || storedRole
  if (currentRole !== 'teacher') {
    return <Navigate to="/profile" replace />
  }
  
  return children
}

export default App

