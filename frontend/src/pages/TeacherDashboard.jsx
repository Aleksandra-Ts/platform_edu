import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../services/api'
import { useAuth } from '../hooks/useAuth'
import '../styles/auth.css'
import '../styles/teacher-dashboard.css'

// Пул смайликов для учебной платформы
const EDUCATION_EMOJIS = [
  '📚', '📖', '📝', '✏️',
  '🎓', '🎯', '💡', '📌', '📍', '🗂️',
  '📂', '📄', '📃', '📑', '📜', '📰', '📓', '📔',
  '📒', '📕', '📘', '✒️', '🖊️', '🖋️', '📝', '💼',
  '📋','📁', '📖'
]

// Функция для получения случайного смайлика для курса (детерминированная на основе id)
// Использует простую хеш-функцию для генерации "случайного" индекса на основе ID
function getCourseEmoji(courseId) {
  // Простая хеш-функция для генерации псевдослучайного числа на основе ID
  let hash = 0
  const str = courseId.toString()
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  // Используем абсолютное значение и модуль для получения индекса
  const index = Math.abs(hash) % EDUCATION_EMOJIS.length
  return EDUCATION_EMOJIS[index]
}

function TeacherDashboard() {
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(false)
  const [profile, setProfile] = useState(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const { role } = useAuth()
  const navigate = useNavigate()
  
  // Проверяем URL параметр для отображения канбана
  const showKanban = searchParams.get('view') === 'courses'

  useEffect(() => {
    // Проверяем роль из localStorage напрямую, так как useAuth может не успеть обновиться
    const storedRole = localStorage.getItem('role')
    if (storedRole !== 'teacher' && role !== 'teacher') {
      navigate('/profile')
      return
    }
    
    loadProfile()
    
    // Если в URL есть параметр view=courses, загружаем курсы
    if (showKanban && courses.length === 0) {
      loadCourses()
    }
  }, [role, navigate, showKanban])

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
      // Обновляем URL для сохранения состояния
      setSearchParams({ view: 'courses' })
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
      setSearchParams({ view: 'courses' })
    }
  }
  
  const handleBackClick = () => {
    setSearchParams({})
  }

  return (
    <div className="teacher-dashboard">
      <div className="dashboard-container">
        {!showKanban ? (
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
                onClick={() => navigate('/profile')}
              >
                <div className="dashboard-card-icon">👤</div>
                <h2 className="dashboard-card-title">Профиль</h2>
              </div>
            </div>
          </>
        ) : (
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
              <div className="empty-state">У вас пока нет курсов</div>
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
        )}
      </div>
    </div>
  )
}

export default TeacherDashboard

