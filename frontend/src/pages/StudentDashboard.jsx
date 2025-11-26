import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import { useAuth } from '../hooks/useAuth'
import GradesTab from '../components/grades/GradesTab'
import '../styles/auth.css'
import '../styles/teacher-dashboard.css'
import '../styles/student-dashboard.css'

// Пул смайликов для учебной платформы
const EDUCATION_EMOJIS = [
  '📚', '📖', '📝', '✏️',
  '🎓', '🎯', '💡', '📌', '📍', '🗂️',
  '📂', '📄', '📃', '📑', '📜', '📰', '📓', '📔',
  '📒', '📕', '📘', '✒️', '🖊️', '🖋️', '📝', '💼',
  '📋','📁', '📖'
]

// Функция для получения случайного смайлика для курса (детерминированная на основе id)
function getCourseEmoji(courseId) {
  let hash = 0
  const str = courseId.toString()
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  const index = Math.abs(hash) % EDUCATION_EMOJIS.length
  return EDUCATION_EMOJIS[index]
}

function StudentDashboard() {
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(false)
  const [profile, setProfile] = useState(null)
  const [activeView, setActiveView] = useState('home') // 'home', 'courses', 'grades'
  const { role } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    const storedRole = localStorage.getItem('role')
    if (storedRole !== 'student' && role !== 'student') {
      navigate('/profile')
      return
    }
    
    loadProfile()
  }, [role, navigate])

  const loadProfile = async () => {
    try {
      const data = await api.getProfile()
      setProfile(data)
    } catch (err) {
      console.error('Ошибка загрузки профиля:', err)
    }
  }

  const loadCourses = async () => {
    try {
      setLoading(true)
      const data = await api.getMyCourses()
      setCourses(data)
      setActiveView('courses')
    } catch (err) {
      console.error('Ошибка загрузки курсов:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleMyCoursesClick = () => {
    if (courses.length === 0 && !loading) {
      loadCourses()
    } else {
      setActiveView('courses')
    }
  }

  const handleGradesClick = () => {
    setActiveView('grades')
  }

  const handleBackClick = () => {
    setActiveView('home')
  }

  return (
    <div className="teacher-dashboard">
      <div className="dashboard-container">
        {activeView === 'home' ? (
          <>
            {profile && (
              <h1 className="welcome-title">
                Добро пожаловать, {profile.full_name || profile.login}
              </h1>
            )}
            <div className="dashboard-cards-grid">
              <div 
                className="dashboard-card"
                onClick={handleMyCoursesClick}
              >
                <div className="dashboard-card-icon">📚</div>
                <h2 className="dashboard-card-title">Мои курсы</h2>
                {loading && <div className="dashboard-card-loading">Загрузка...</div>}
              </div>
              <div 
                className="dashboard-card"
                onClick={handleGradesClick}
              >
                <div className="dashboard-card-icon">📊</div>
                <h2 className="dashboard-card-title">Мои оценки</h2>
              </div>
              <div 
                className="dashboard-card"
                onClick={() => navigate('/profile')}
              >
                <div className="dashboard-card-icon">👤</div>
                <h2 className="dashboard-card-title">Профиль</h2>
              </div>
            </div>
          </>
        ) : activeView === 'courses' ? (
          <div className="kanban-view">
            <div className="breadcrumbs">
              <span className="breadcrumb-item" onClick={handleBackClick}>
                Главная
              </span>
              <span className="breadcrumb-separator">/</span>
              <span className="breadcrumb-item active">Мои курсы</span>
            </div>
            
            {loading ? (
              <div className="loading-state">Загрузка курсов...</div>
            ) : courses.length === 0 ? (
              <div className="empty-state">
                <p>У вас пока нет доступных курсов</p>
                <p className="hint">Курсы появятся здесь после того, как преподаватель опубликует лекции</p>
              </div>
            ) : (
              <div className="kanban-board">
                <div className="kanban-column">
                  <div className="kanban-cards">
                    {courses.map(course => (
                      <div 
                        key={course.id} 
                        className="course-card"
                        onClick={() => navigate(`/course/${course.id}`)}
                      >
                        <div className="course-emoji">{getCourseEmoji(course.id)}</div>
                        <div className="course-name-wrapper">
                          <div className="course-name">{course.name}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : activeView === 'grades' ? (
          <div className="grades-view">
            <div className="breadcrumbs">
              <span className="breadcrumb-item" onClick={handleBackClick}>
                Главная
              </span>
              <span className="breadcrumb-separator">/</span>
              <span className="breadcrumb-item active">Мои оценки</span>
            </div>
            <GradesTab profile={profile} />
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default StudentDashboard

