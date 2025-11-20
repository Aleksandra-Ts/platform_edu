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
    // Проверяем роль
    const storedRole = localStorage.getItem('role')
    if (storedRole !== 'teacher' && role !== 'teacher') {
      navigate('/profile')
      return
    }

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

  const handleBackClick = () => {
    navigate('/dashboard?view=courses')
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
            <span className="breadcrumb-item" onClick={handleBackClick}>
              Главная
            </span>
            <span className="breadcrumb-separator">/</span>
            <span className="breadcrumb-item" onClick={handleBackClick}>
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
    <div className="lectures-tab" style={{ 
      minHeight: '200px', 
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      gap: '2rem',
      padding: '1rem 0'
    }}>
      <div className="lectures-header" style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '1.5rem',
        width: '100%'
      }}>
        <h2 style={{ 
          margin: 0, 
          fontSize: '1.75rem', 
          color: '#0b3d2c',
          fontWeight: '600'
        }}>Лекции</h2>
        <button
          className="btn-primary"
          onClick={handleCreateNew}
          type="button"
          style={{ 
            cursor: 'pointer',
            padding: '0.5rem 1rem',
            background: 'linear-gradient(135deg, #0f6b51, #115b49)',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '0.95rem',
            fontWeight: '500',
            boxShadow: '0 2px 4px rgba(15, 107, 81, 0.2)',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.target.style.transform = 'translateY(-1px)'
            e.target.style.boxShadow = '0 4px 8px rgba(15, 107, 81, 0.3)'
          }}
          onMouseLeave={(e) => {
            e.target.style.transform = 'translateY(0)'
            e.target.style.boxShadow = '0 2px 4px rgba(15, 107, 81, 0.2)'
          }}
        >
          + Создать лекцию
        </button>
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
        />
      )}

      {!showBuilder && (
        <div className="lectures-list" style={{ width: '100%' }}>
          {lectures.length === 0 ? (
            <div className="empty-state" style={{
              textAlign: 'center',
              padding: '3rem',
              color: 'rgba(11, 47, 36, 0.6)',
              fontSize: '1.1rem',
              backgroundColor: '#f8fffe',
              borderRadius: '12px',
              border: '1px solid rgba(17, 91, 73, 0.1)'
            }}>
              <p style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', color: '#0b3d2c' }}>Лекции не найдены</p>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#666' }}>
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
  const handleDelete = async () => {
    if (!confirm('Удалить эту лекцию?')) return
    try {
      await api.deleteLecture(lecture.id)
      onUpdate()
    } catch (err) {
      alert('Ошибка удаления лекции: ' + err.message)
    }
  }

  return (
    <div className="lecture-card">
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
      <div className="lecture-actions">
        <button className="btn-outline" onClick={onEdit} title="Открыть конструктор">
          🛠️ Конструктор
        </button>
        <button className="btn-delete" onClick={handleDelete} title="Удалить лекцию">
          🗑️ Удалить
        </button>
      </div>
    </div>
  )
}

export default CourseDetail

