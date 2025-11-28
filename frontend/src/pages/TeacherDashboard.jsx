import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../services/api'
import DashboardBase from '../components/dashboard/DashboardBase'

function TeacherDashboard() {
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  
  // Проверяем URL параметр для отображения канбана
  const showKanban = searchParams.get('view') === 'courses'
  const activeView = showKanban ? 'courses' : 'home'

  useEffect(() => {
    // Если в URL есть параметр view=courses, загружаем курсы
    if (showKanban && courses.length === 0 && !loading) {
      loadCourses()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showKanban])

  const loadCourses = async () => {
    try {
      setLoading(true)
      const data = await api.getMyCourses()
      setCourses(data)
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

  const setActiveView = (view) => {
    if (view === 'courses') {
      setSearchParams({ view: 'courses' })
    } else {
      setSearchParams({})
    }
  }

  const handleBackClick = () => {
    setSearchParams({})
  }
  
  return (
    <DashboardBase
      role="teacher"
      cards={[
        {
          icon: '📚',
          title: 'Мои курсы',
          onClick: handleMyCoursesClick,
          loading: loading
        },
        {
          icon: '👤',
          title: 'Профиль',
          onClick: () => navigate('/profile')
        }
      ]}
      activeView={activeView}
      setActiveView={setActiveView}
      courses={courses}
      loading={loading}
      onLoadCourses={loadCourses}
      onBackClick={handleBackClick}
    />
  )
}

export default TeacherDashboard

