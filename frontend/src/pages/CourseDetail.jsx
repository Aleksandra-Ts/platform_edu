import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../services/api'
import { useAuth } from '../hooks/useAuth'
import LectureBuilder from '../components/lectures/LectureBuilder'
import '../styles/auth.css'
import '../styles/course-detail.css'

function CourseDetail() {
  const { courseId } = useParams()
  const navigate = useNavigate()
  const { role } = useAuth()
  const [course, setCourse] = useState(null)
  const [lectures, setLectures] = useState([])
  const [activeTab, setActiveTab] = useState('lectures')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadCourse()
    loadLectures()
  }, [courseId, navigate, role])

  const loadCourse = async () => {
    try {
      // getCourse уже определяет роль и использует правильный эндпоинт
      const data = await api.getCourse(courseId)
      setCourse(data)
    } catch (err) {
      console.error('Ошибка загрузки курса:', err)
      setCourse(null)
    } finally {
      setLoading(false)
    }
  }

  const loadLectures = async () => {
    try {
      const data = await api.getLectures(courseId)
      setLectures(data)
    } catch (err) {
      console.error('Ошибка загрузки лекций:', err)
    }
  }

  const handleHomeClick = () => {
    const currentRole = role || localStorage.getItem('role')
    if (currentRole === 'teacher') {
      navigate('/dashboard')
    } else if (currentRole === 'student') {
      navigate('/student-dashboard')
    } else if (currentRole === 'admin') {
      navigate('/admin')
    } else {
      navigate('/profile')
    }
  }

  const handleCoursesClick = () => {
    const currentRole = role || localStorage.getItem('role')
    if (currentRole === 'teacher') {
      navigate('/dashboard?view=courses')
    } else if (currentRole === 'student') {
      navigate('/student-dashboard')
    } else {
      navigate('/profile')
    }
  }

  if (loading) {
    return (
      <div className="course-detail">
        <div className="course-detail-container">
          <div className="loading-state">Загрузка...</div>
        </div>
      </div>
    )
  }

  if (!course) {
    return (
      <div className="course-detail">
        <div className="course-detail-container">
          <div className="error-state">Курс не найден</div>
        </div>
      </div>
    )
  }

  console.log('CourseDetail render:', { courseId, course, lecturesCount: lectures?.length, activeTab })

  return (
    <div className="course-detail">
      <div className="course-detail-container">
        <div className="course-detail-header">
          <div className="breadcrumbs">
            <span className="breadcrumb-item" onClick={handleHomeClick}>
              Главная
            </span>
            <span className="breadcrumb-separator">/</span>
            <span className="breadcrumb-item" onClick={handleCoursesClick}>
              Мои курсы
            </span>
            <span className="breadcrumb-separator">/</span>
            <span className="breadcrumb-item active">{course.name}</span>
          </div>
        </div>

        <h1 className="course-title">{course.name}</h1>

        <div className="course-tabs">
          <button
            className={`tab-button ${activeTab === 'lectures' ? 'active' : ''}`}
            onClick={() => setActiveTab('lectures')}
          >
            Лекции
          </button>
          <button
            className={`tab-button ${activeTab === 'assignments' ? 'active' : ''}`}
            onClick={() => setActiveTab('assignments')}
          >
            Задания
          </button>
        </div>

        <div className="tab-content">
          {activeTab === 'lectures' && courseId && (
            <LecturesTab courseId={courseId} lectures={lectures || []} onLecturesChange={loadLectures} />
          )}
          {activeTab === 'assignments' && (
            <div className="assignments-placeholder">
              <p>Функционал заданий будет добавлен позже</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function LecturesTab({ courseId, lectures, onLecturesChange }) {
  const { role } = useAuth()
  const [showBuilder, setShowBuilder] = useState(false)
  const [editingLecture, setEditingLecture] = useState(null)

  const handleCreateNew = () => {
    console.log('Создание новой лекции')
    setEditingLecture({ id: null, name: '', description: '', materials: [] })
    setShowBuilder(true)
  }

  const handleCloseBuilder = () => {
    setShowBuilder(false)
    setEditingLecture(null)
    onLecturesChange()
  }

  console.log('LecturesTab render:', { courseId, lecturesCount: lectures?.length, showBuilder })

  if (!courseId) {
    return <div className="error-state">Ошибка: не указан ID курса</div>
  }

  return (
    <div className="lectures-tab">
      <div className="lectures-header">
        <h2 className="lectures-title">Лекции</h2>
        {(role === 'teacher' || localStorage.getItem('role') === 'teacher') && (
          <button
            className="btn-create-lecture"
            onClick={handleCreateNew}
            type="button"
          >
            + Создать лекцию
          </button>
        )}
      </div>

      {showBuilder && editingLecture && (
        <LectureBuilder 
          lecture={editingLecture} 
          courseId={courseId}
          onClose={handleCloseBuilder} 
          onUpdate={() => {
            onLecturesChange()
            // После создания лекции закрываем конструктор и обновляем список
            if (editingLecture && !editingLecture.id) {
              // Это была новая лекция, закрываем конструктор после создания
              setTimeout(() => {
                setShowBuilder(false)
                setEditingLecture(null)
              }, 500)
            }
          }}
          onDelete={() => {
            onLecturesChange()
            setShowBuilder(false)
            setEditingLecture(null)
          }}
        />
      )}

      {!showBuilder && (
        <div className="lectures-list">
          {lectures.length === 0 ? (
            <div className="lectures-empty-state">
              <p className="lectures-empty-title">Лекции не найдены</p>
              <p className="lectures-empty-text">
                Нажмите кнопку "+ Создать лекцию" выше, чтобы создать новую лекцию
              </p>
            </div>
          ) : (
            lectures.map(lecture => (
              <LectureCard 
                key={lecture.id} 
                lecture={lecture} 
                onUpdate={onLecturesChange}
                onEdit={() => {
                  setEditingLecture(lecture)
                  setShowBuilder(true)
                }}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}

function LectureCard({ lecture, onUpdate, onEdit }) {
  const { role } = useAuth()
  const navigate = useNavigate()
  
  const handleCardClick = () => {
    const currentRole = role || localStorage.getItem('role')
    if (currentRole === 'teacher') {
      onEdit()
    } else if (currentRole === 'student') {
      navigate(`/course/${lecture.course_id}/lecture/${lecture.id}`)
    }
  }

  const currentRole = role || localStorage.getItem('role')
  const isTeacher = currentRole === 'teacher'

  return (
    <div className="lecture-card" onClick={handleCardClick}>
      {lecture.published && isTeacher && (
        <div className="lecture-published-badge" title="Лекция опубликована">
          Опубликовано
        </div>
      )}
      <div className="lecture-info">
        <h3 className="lecture-name">{lecture.name}</h3>
        {lecture.description && (
          <p className="lecture-description">{lecture.description}</p>
        )}
        <div className="lecture-materials">
          <span className="materials-count">
            Материалов: {lecture.materials?.length || 0}
          </span>
        </div>
      </div>
    </div>
  )
}

export default CourseDetail

