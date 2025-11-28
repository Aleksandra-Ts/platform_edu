import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'
import { useAuth } from '../../hooks/useAuth'
import { getCourseEmoji } from '../../utils/courseUtils'
import Breadcrumbs from '../common/Breadcrumbs'
import '../../styles/auth.css'
import '../../styles/teacher-dashboard.css'
import '../../styles/student-dashboard.css'

/**
 * Базовый компонент для dashboard преподавателя и студента
 * @param {string} role - Роль пользователя: 'teacher' | 'student'
 * @param {Array} cards - Массив карточек для отображения на главной странице
 * @param {React.Component} customView - Кастомный компонент для дополнительного view (например, GradesTab)
 * @param {string} customViewKey - Ключ для кастомного view (например, 'grades')
 * @param {string} customViewTitle - Заголовок для кастомного view (например, 'Мои оценки')
 * @param {string} activeView - Текущий активный view ('home', 'courses', или customViewKey)
 * @param {Function} setActiveView - Функция для изменения activeView (опционально, если используется локальный state)
 * @param {Function} onLoadCourses - Функция для загрузки курсов (опционально)
 * @param {Array} courses - Массив курсов (опционально, если управляется извне)
 * @param {boolean} loading - Состояние загрузки (опционально)
 * @param {Function} onBackClick - Функция для обработки возврата на главную (опционально)
 */
function DashboardBase({ 
  role,
  cards = [],
  customView = null,
  customViewKey = null,
  customViewTitle = null,
  activeView: externalActiveView = null,
  setActiveView: externalSetActiveView = null,
  onLoadCourses = null,
  courses: externalCourses = null,
  loading: externalLoading = false,
  onBackClick = null
}) {
  const [internalCourses, setInternalCourses] = useState([])
  const [internalLoading, setInternalLoading] = useState(false)
  const [internalActiveView, setInternalActiveView] = useState('home')
  const [profile, setProfile] = useState(null)
  const { getRole } = useAuth()
  const navigate = useNavigate()
  const isTeacher = role === 'teacher'

  // Используем внешние или внутренние значения
  const courses = externalCourses !== null ? externalCourses : internalCourses
  const loading = externalLoading !== false ? externalLoading : internalLoading
  const activeView = externalActiveView !== null ? externalActiveView : internalActiveView
  const setActiveView = externalSetActiveView || setInternalActiveView

  useEffect(() => {
    const storedRole = getRole()
    if (storedRole !== role) {
      navigate('/profile')
      return
    }
    
    // Загружаем профиль только один раз
    if (!profile) {
      loadProfile()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    if (onLoadCourses) {
      onLoadCourses()
      return
    }
    
    try {
      setInternalLoading(true)
      const data = await api.getMyCourses()
      setInternalCourses(data)
      setActiveView('courses')
    } catch (err) {
      console.error('Ошибка загрузки курсов:', err)
    } finally {
      setInternalLoading(false)
    }
  }

  const handleBackClick = () => {
    setActiveView('home')
  }

  const renderCoursesView = () => {
    // Используем переданный handleBackClick или внутренний
    const backHandler = onBackClick || handleBackClick
    
    return (
      <div className="kanban-view">
        <Breadcrumbs
          items={[
            { label: 'Главная', onClick: backHandler },
            { label: 'Мои курсы', active: true }
          ]}
        />
      
      {loading ? (
        <div className="loading-state">Загрузка курсов...</div>
      ) : courses.length === 0 ? (
        <div className="empty-state">
          {isTeacher ? (
            'У вас пока нет курсов'
          ) : (
            <>
              <p>У вас пока нет доступных курсов</p>
              <p className="hint">Курсы появятся здесь после того, как преподаватель опубликует лекции</p>
            </>
          )}
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
    )
  }

  const renderCustomView = () => {
    if (!customView || !customViewKey || !customViewTitle) return null
    
    // Используем переданный handleBackClick или внутренний
    const backHandler = onBackClick || handleBackClick
    
    return (
      <div className="grades-view">
        <Breadcrumbs
          items={[
            { label: 'Главная', onClick: backHandler },
            { label: customViewTitle, active: true }
          ]}
        />
        {customView}
      </div>
    )
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
              {cards.map((card, index) => (
                <div 
                  key={index}
                  className="dashboard-card"
                  onClick={card.onClick}
                >
                  <div className="dashboard-card-icon">{card.icon}</div>
                  <h2 className="dashboard-card-title">{card.title}</h2>
                  {card.loading && <div className="dashboard-card-loading">Загрузка...</div>}
                </div>
              ))}
            </div>
          </>
        ) : activeView === 'courses' ? (
          renderCoursesView()
        ) : activeView === customViewKey ? (
          renderCustomView()
        ) : null}
      </div>
    </div>
  )
}

export default DashboardBase

