import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useEffect, useMemo } from 'react'
import Home from './pages/Home'
import Login from './pages/Login'
import Profile from './pages/Profile'
import Admin from './pages/Admin'
import TeacherDashboard from './pages/TeacherDashboard'
import StudentDashboard from './pages/StudentDashboard'
import CourseDetail from './pages/CourseDetail'
import LectureView from './pages/LectureView'
import ChangePassword from './pages/ChangePassword'
import { useAuth } from './hooks/useAuth'
import { getCurrentRole } from './utils/navigation'
import api from './services/api'

function App() {
  const navigate = useNavigate()
  
  // Устанавливаем обработчик навигации для api.js
  useEffect(() => {
    api.setNavigationHandler(navigate)
  }, [navigate])

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
        path="/student-dashboard" 
        element={
          <StudentRoute>
            <StudentDashboard />
          </StudentRoute>
        } 
      />
      <Route 
        path="/course/:courseId" 
        element={
          <ProtectedRoute>
            <CourseDetail />
          </ProtectedRoute>
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
  const { token } = useAuth()
  const isAuth = useMemo(() => !!token, [token])
  
  if (!isAuth) {
    return <Navigate to="/login" replace />
  }
  
  return children
}

function AdminRoute({ children }) {
  const { token, role } = useAuth()
  const isAuth = useMemo(() => !!token, [token])
  const isAdminRole = useMemo(() => role === 'admin', [role])
  
  if (!isAuth) {
    return <Navigate to="/login" replace />
  }
  
  if (!isAdminRole) {
    return <Navigate to="/profile" replace />
  }
  
  return children
}

// Универсальный компонент для маршрутов с проверкой роли
function RoleRoute({ children, requiredRole }) {
  const { token, role } = useAuth()
  const isAuth = useMemo(() => !!token, [token])
  const currentRole = useMemo(() => getCurrentRole(role), [role])
  const hasRequiredRole = useMemo(() => currentRole === requiredRole, [currentRole, requiredRole])
  
  if (!isAuth) {
    return <Navigate to="/login" replace />
  }
  
  if (!hasRequiredRole) {
    return <Navigate to="/profile" replace />
  }
  
  return children
}

function TeacherRoute({ children }) {
  return <RoleRoute requiredRole="teacher">{children}</RoleRoute>
}

function StudentRoute({ children }) {
  return <RoleRoute requiredRole="student">{children}</RoleRoute>
}

export default App

