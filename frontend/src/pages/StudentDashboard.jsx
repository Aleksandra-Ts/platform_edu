import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import { useAuth } from '../hooks/useAuth'
import DashboardBase from '../components/dashboard/DashboardBase'
import GradesTab from '../components/grades/GradesTab'

function StudentDashboard() {
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(false)
  const [profile, setProfile] = useState(null)
  const [activeView, setActiveView] = useState('home') // 'home', 'courses', 'grades'
  const { role, getRole } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    const storedRole = getRole()
    if (storedRole !== 'student' && role !== 'student') {
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

  return (
    <DashboardBase
      role="student"
      cards={[
        {
          icon: '📚',
          title: 'Мои курсы',
          onClick: handleMyCoursesClick,
          loading: loading
        },
        {
          icon: '📊',
          title: 'Мои оценки',
          onClick: handleGradesClick
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
      customView={<GradesTab profile={profile} />}
      customViewKey="grades"
      customViewTitle="Мои оценки"
    />
  )
}

export default StudentDashboard

