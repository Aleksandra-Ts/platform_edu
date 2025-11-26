import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../services/api'
import { useAuth } from '../hooks/useAuth'
import TestCard from '../components/assignments/TestCard'
import '../styles/lecture-view.css'

function LectureView() {
  const { courseId, lectureId } = useParams()
  const navigate = useNavigate()
  const { role } = useAuth()
  const [lecture, setLecture] = useState(null)
  const [course, setCourse] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showTest, setShowTest] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [attempts, setAttempts] = useState(null)
  const [hasAttempts, setHasAttempts] = useState(false)
  const [remainingAttempts, setRemainingAttempts] = useState(null)
  const [canViewResults, setCanViewResults] = useState(false)

  // Функция для парсинга дедлайна (поддерживает формат YYYY-MM-DDTHH:mm и ISO)
  const parseDeadline = (deadlineString) => {
    if (!deadlineString) return null
    // Если формат YYYY-MM-DDTHH:mm (локальное время, без таймзоны)
    if (deadlineString.includes('T') && !deadlineString.includes('Z') && !deadlineString.includes('+')) {
      const [datePart, timePart] = deadlineString.split('T')
      return new Date(`${datePart}T${timePart}`)
    }
    // Иначе парсим как ISO или другой формат
    return new Date(deadlineString)
  }

  useEffect(() => {
    loadLecture()
    loadCourse()
  }, [lectureId, courseId])

  useEffect(() => {
    // Проверяем наличие попыток при загрузке лекции
    if (lecture && lecture.generate_test && role === 'student') {
      checkAttempts()
    }
  }, [lecture, role])

  const checkAttempts = async () => {
    try {
      const attemptsData = await api.getTestAttempts(lectureId)
      const maxAttempts = lecture?.test_max_attempts || 1
      
      if (attemptsData.attempts && attemptsData.attempts.length > 0) {
        setAttempts(attemptsData)
        setHasAttempts(true)
        
        // Вычисляем оставшиеся попытки
        const usedAttempts = attemptsData.attempts.length
        const remaining = Math.max(0, maxAttempts - usedAttempts)
        setRemainingAttempts(remaining)
        
        // Проверяем, можно ли просматривать результаты
        // Результаты доступны только если:
        // 1. Есть попытки
        // 2. Попытки закончились ИЛИ дедлайн истек
        // 3. Дедлайн истек (чтобы показывать правильные ответы)
        // 4. Разрешено показывать ответы
        const deadlinePassed = lecture?.test_deadline ? parseDeadline(lecture.test_deadline) < new Date() : false
        const allAttemptsUsed = remaining <= 0
        
        // Результаты можно просматривать если:
        // - Есть попытки И дедлайн истек И разрешено показывать ответы
        setCanViewResults(deadlinePassed && lecture?.test_show_answers)
      } else {
        setHasAttempts(false)
        setRemainingAttempts(maxAttempts)
        setCanViewResults(false)
      }
    } catch (err) {
      // Если ошибка (нет попыток или тест не найден), просто не показываем результаты
      setHasAttempts(false)
      setRemainingAttempts(lecture?.test_max_attempts || 1)
      setCanViewResults(false)
    }
  }

  const loadLecture = async () => {
    try {
      setLoading(true)
      const data = await api.getLecture(lectureId)
      setLecture(data)
    } catch (err) {
      console.error('Ошибка загрузки лекции:', err)
      setError('Лекция не найдена')
    } finally {
      setLoading(false)
    }
  }

  const loadCourse = async () => {
    try {
      const data = await api.getCourse(courseId)
      setCourse(data)
    } catch (err) {
      console.error('Ошибка загрузки курса:', err)
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

  const handleCourseClick = () => {
    navigate(`/course/${courseId}`)
  }

  if (loading) {
    return (
      <div className="lecture-view-page">
        <div className="lecture-view-container">
          <div className="loading-state">Загрузка лекции...</div>
        </div>
      </div>
    )
  }

  if (error || !lecture) {
    return (
      <div className="lecture-view-page">
        <div className="lecture-view-container">
          <div className="error-state">{error || 'Лекция не найдена'}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="lecture-view-page">
      <div className="lecture-view-container">
        <div className="lecture-view-header">
          <div className="breadcrumbs">
            <span className="breadcrumb-item" onClick={handleHomeClick}>
              Главная
            </span>
            <span className="breadcrumb-separator">/</span>
            <span className="breadcrumb-item" onClick={handleCoursesClick}>
              Мои курсы
            </span>
            <span className="breadcrumb-separator">/</span>
            <span className="breadcrumb-item" onClick={handleCourseClick}>
              {course?.name || 'Курс'}
            </span>
            <span className="breadcrumb-separator">/</span>
            <span className="breadcrumb-item active">{lecture.name}</span>
          </div>
        </div>

        <div className="lecture-view-title-section">
          <h1 className="lecture-view-title">{lecture.name}</h1>
        </div>
        
        {role === 'student' && lecture.generate_test && (
          <div className="lecture-test-status-section">
            <div className="test-status-info">
              {lecture.test_max_attempts && (
                <div className="test-attempts-status">
                  {remainingAttempts !== null && remainingAttempts > 0 ? (
                    <span className="test-attempts-remaining">
                      Осталось попыток: <strong>{remainingAttempts}</strong> из {lecture.test_max_attempts}
                    </span>
                  ) : hasAttempts ? (
                    <span className="test-attempts-exhausted">
                      Все попытки использованы ({lecture.test_max_attempts}/{lecture.test_max_attempts})
                    </span>
                  ) : (
                    <span className="test-attempts-available">
                      Доступно попыток: <strong>{lecture.test_max_attempts}</strong>
                    </span>
                  )}
                  {lecture.test_deadline && (
                    <span className="test-deadline-info">
                      Дедлайн: {parseDeadline(lecture.test_deadline)?.toLocaleString('ru-RU', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                      })}
                      {parseDeadline(lecture.test_deadline) < new Date() && (
                        <span className="test-deadline-expired">✓ Истек</span>
                      )}
                    </span>
                  )}
                </div>
              )}
            </div>
            
            <div className="test-actions-container">
              {(() => {
                const deadlinePassed = lecture.test_deadline ? parseDeadline(lecture.test_deadline) < new Date() : false
                const allAttemptsUsed = remainingAttempts !== null && remainingAttempts <= 0
                
                // Показываем кнопку "Решить тест" если есть оставшиеся попытки И дедлайн не истек
                if (remainingAttempts !== null && remainingAttempts > 0 && !deadlinePassed) {
                  return (
                    <button
                      className="btn-solve-test"
                      onClick={() => {
                        setShowTest(true)
                      }}
                    >
                      📝 Решить тест
                    </button>
                  )
                }
                
                // Показываем кнопку "Посмотреть результаты" если:
                // 1. Есть попытки
                // 2. Дедлайн истек
                // 3. Разрешено показывать ответы
                if (hasAttempts && deadlinePassed && lecture.test_show_answers) {
                  return (
                    <button
                      className="btn-view-results"
                      onClick={() => {
                        setShowResults(true)
                      }}
                    >
                      📊 Посмотреть результаты
                    </button>
                  )
                }
                
                // Если дедлайн истек, но нет попыток - показываем сообщение
                if (deadlinePassed && !hasAttempts) {
                  return (
                    <div className="test-warning-message test-warning-error">
                      ⚠️ Дедлайн истек. У вас нет попыток прохождения теста.
                    </div>
                  )
                }
                
                // Предупреждение если попытки закончились, но дедлайн не истек
                if (hasAttempts && allAttemptsUsed && !deadlinePassed) {
                  return (
                    <div className="test-warning-message test-warning-yellow">
                      ⚠️ Все попытки использованы. Результаты будут доступны после окончания дедлайна ({parseDeadline(lecture.test_deadline)?.toLocaleString('ru-RU', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}).
                    </div>
                  )
                }
                
                // Если дедлайн истек, но нет попыток
                if (deadlinePassed && !hasAttempts) {
                  return (
                    <div className="test-warning-message test-warning-error">
                      ⚠️ Дедлайн истек. Тест больше недоступен для прохождения.
                    </div>
                  )
                }
                
                return null
              })()}
            </div>
          </div>
        )}
        {lecture.description && (
          <p className="lecture-view-description">{lecture.description}</p>
        )}

        {showTest && role === 'student' && (
          <div className="test-modal-overlay" onClick={() => setShowTest(false)}>
            <div className="test-modal-content" onClick={(e) => e.stopPropagation()}>
              <button className="test-modal-close" onClick={() => setShowTest(false)}>×</button>
              <TestViewer 
                lectureId={lectureId} 
                lecture={lecture} 
                onClose={async () => {
                  setShowTest(false)
                  // После закрытия проверяем попытки снова
                  await checkAttempts()
                }}
                onTestSubmitted={async () => {
                  // После прохождения теста обновляем информацию о попытках
                  await checkAttempts()
                }}
              />
            </div>
          </div>
        )}

        {showResults && role === 'student' && attempts && (
          <div className="test-modal-overlay" onClick={() => setShowResults(false)}>
            <div className="test-modal-content" onClick={(e) => e.stopPropagation()}>
              <button className="test-modal-close" onClick={() => setShowResults(false)}>×</button>
              <TestResultsViewer attempts={attempts} lecture={lecture} onClose={() => setShowResults(false)} />
            </div>
          </div>
        )}

        <div className="lecture-materials-view">
          {lecture.materials && lecture.materials.length > 0 ? (
            lecture.materials.map((material, index) => (
              <MaterialViewer
                key={material.id}
                material={material}
                index={index + 1}
                lecture={lecture}
              />
            ))
          ) : (
            <div className="empty-materials">
              <p>Материалы не добавлены</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function TestViewer({ lectureId, lecture, onClose, onTestSubmitted }) {
  // Передаем callback в TestCard для обновления попыток после прохождения
  const { role } = useAuth()
  const [test, setTest] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadTest()
  }, [lectureId, lecture])

  const loadTest = async () => {
    setLoading(true)
    setError(null)
    try {
      // Проверяем дедлайн - но не блокируем, если есть оставшиеся попытки
      // Дедлайн проверяется на бэкенде
      const testData = await api.getLectureTest(lectureId)
      setTest(testData)
    } catch (err) {
      console.error('Ошибка загрузки теста:', err)
      setError(err.message || 'Не удалось загрузить тест')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="test-loading">Загрузка теста...</div>
  }

  if (error) {
    return <div className="test-error">{error}</div>
  }

  if (!test) {
    return <div className="test-error">Тест не найден</div>
  }

  return <TestCard 
    test={test} 
    lectureId={lectureId} 
    lecture={lecture} 
    role={role} 
    onTestSubmitted={onTestSubmitted}
  />
}

function TestResultsViewer({ attempts, lecture, onClose }) {
  const { role } = useAuth()
  
  if (!attempts || !attempts.attempts || attempts.attempts.length === 0) {
    return (
      <div className="test-results-viewer">
        <h2>Результаты теста</h2>
        <div className="test-results-empty">
          ⚠️ У вас нет попыток прохождения теста. Результаты будут доступны после прохождения теста.
        </div>
      </div>
    )
  }

  // Проверяем, можно ли показывать правильные ответы
  // Правильные ответы показываются если:
  // 1. Дедлайн истек
  // 2. Разрешено в настройках (test_show_answers = true)
  const deadlinePassed = lecture?.test_deadline ? parseDeadline(lecture.test_deadline) < new Date() : false
  const shouldShowAnswers = lecture?.test_show_answers && deadlinePassed
  
  // Используем show_answers из API, если есть, иначе вычисляем
  const showAnswers = attempts.show_answers !== undefined ? attempts.show_answers : shouldShowAnswers

  // Вычисляем максимальную оценку из всех попыток
  const maxScore = attempts.max_score || attempts.attempts.reduce((max, attempt) => {
    const score = (attempt.score / attempt.total_questions) * 100
    return Math.max(max, score)
  }, 0)
  
  const maxAttempt = attempts.attempts.reduce((best, attempt) => {
    const currentScore = (attempt.score / attempt.total_questions) * 100
    const bestScore = (best.score / best.total_questions) * 100
    return currentScore > bestScore ? attempt : best
  }, attempts.attempts[0])

  return (
    <div className="test-results-viewer">
      <h2>Результаты теста</h2>
      
      {/* Итоговая информация */}
      <div className="test-results-summary">
        <div className="test-results-summary-title">
          Итоговая оценка
        </div>
        <div className="test-results-summary-score">
          {maxScore.toFixed(1)}%
        </div>
        <div className="test-results-summary-details">
          Лучший результат: {maxAttempt.score} / {maxAttempt.total_questions} правильных ответов
          <br />
          Всего попыток: {attempts.attempts.length} / {attempts.max_attempts}
        </div>
      </div>
      
      <div className="test-attempts-list">
        {attempts.attempts.map((attempt, index) => (
          <div key={attempt.id} className="test-attempt-item">
            <div className="attempt-header">
              <h3 className="attempt-number">
                Попытка {attempts.attempts.length - index}
              </h3>
              <div className="attempt-date">
                Завершено: {new Date(attempt.completed_at).toLocaleString('ru-RU')}
              </div>
              <div className="attempt-score">
                Оценка: {attempt.score} / {attempt.total_questions} ({((attempt.score / attempt.total_questions) * 100).toFixed(1)}%)
              </div>
            </div>
            
            <div className="attempt-questions">
              {attempt.results.map((result, qIndex) => (
                <div key={result.question_id} className="attempt-question">
                  <div className="attempt-question-header">
                    Вопрос {qIndex + 1}
                  </div>
                  <p className="attempt-question-text">{result.question_text}</p>
                  
                  <div className="answer-comparison">
                    <div className={`student-answer ${result.is_correct ? 'correct' : 'incorrect'}`}>
                      <strong>Ваш ответ:</strong> {result.student_answer || 'Не отвечено'}
                      {result.is_correct ? (
                        <span className="answer-status-correct">✓ Правильно</span>
                      ) : (
                        <span className="answer-status-incorrect">✗ Неправильно</span>
                      )}
                    </div>
                    
                    {/* Показываем правильный ответ только если:
                        1. Разрешено показывать (show_answers = true)
                        2. И ответ студента НЕ правильный (чтобы не дублировать) */}
                    {(() => {
                      const canShow = (attempt.show_answers !== undefined ? attempt.show_answers : showAnswers)
                      const correctAnswer = result.correct_answer || ''
                      
                      // Показываем правильный ответ только если:
                      // - Разрешено показывать
                      // - Есть правильный ответ
                      // - И ответ студента НЕ правильный (чтобы не дублировать)
                      if (canShow && correctAnswer && !result.is_correct) {
                        return (
                          <div className="correct-answer">
                            <strong>Правильный ответ:</strong> {correctAnswer}
                          </div>
                        )
                      } else if (canShow && !correctAnswer && !result.is_correct) {
                        // Если разрешено показывать, но ответ пустой и студент ответил неправильно
                        return (
                          <div className="answers-hidden-message">
                            Правильный ответ недоступен
                          </div>
                        )
                      } else if (!canShow) {
                        // Если не разрешено показывать
                        return (
                          <div className="answers-hidden-message">
                            Правильные ответы будут показаны после окончания дедлайна
                          </div>
                        )
                      }
                      // Если ответ правильный и разрешено показывать - не показываем правильный ответ (чтобы не дублировать)
                      return null
                    })()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function MaterialViewer({ material, index, lecture }) {
  const [fileText, setFileText] = useState(null)
  const [fileBlobUrl, setFileBlobUrl] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [transcript, setTranscript] = useState(null)
  const [transcribing, setTranscribing] = useState(false)
  const [showTranscript, setShowTranscript] = useState(false)

  useEffect(() => {
    // Загружаем текстовое содержимое для PDF и Word через API
    if (material.file_type === 'pdf' || material.file_name?.endsWith('.docx') || material.file_name?.endsWith('.doc')) {
      loadFileText()
    }
    
    // Загружаем файлы (видео, аудио) через blob URL для поддержки авторизации
    if (material.file_type === 'video' || material.file_type === 'audio') {
      loadFileAsBlob()
    }
    
    // Cleanup blob URL при размонтировании
    return () => {
      if (fileBlobUrl) {
        URL.revokeObjectURL(fileBlobUrl)
        setFileBlobUrl(null)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [material.id])

  const loadFileText = async () => {
    try {
      setLoading(true)
      const response = await api.getMaterialContent(material.id)
      if (response.content) {
        setFileText(response.content)
        setError(null)
      } else if (response.error) {
        setError(response.error)
        setFileText(null)
      }
    } catch (err) {
      console.error('Ошибка загрузки содержимого файла:', err)
      setError(err.message || 'Не удалось загрузить содержимое файла.')
      setFileText(null)
    } finally {
      setLoading(false)
    }
  }

  const loadFileAsBlob = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')
      const API_BASE = import.meta.env.DEV ? '/api' : ''
      const url = `${API_BASE}/materials/${material.id}/file`
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const blob = await response.blob()
      const blobUrl = URL.createObjectURL(blob)
      setFileBlobUrl(blobUrl)
    } catch (err) {
      console.error('Ошибка загрузки файла:', err)
      setError('Не удалось загрузить файл.')
    } finally {
      setLoading(false)
    }
  }

  const getFileUrl = () => {
    // Используем API эндпоинт для доступа к файлам с проверкой прав
    const API_BASE = import.meta.env.DEV ? '/api' : ''
    return `${API_BASE}/materials/${material.id}/file`
  }

  const handleTranscribe = async () => {
    if (transcript) {
      // Если транскрипт уже есть, просто показываем/скрываем его
      setShowTranscript(!showTranscript)
      return
    }

    // Проверку публикации делаем на бэкенде, здесь просто запрашиваем транскрипт
    try {
      setTranscribing(true)
      const result = await api.transcribeVideo(material.id)
      setTranscript(result)
      setShowTranscript(true)
    } catch (err) {
      console.error('Ошибка транскрибации:', err)
      alert('Ошибка транскрибации: ' + (err.message || 'Не удалось транскрибировать видео'))
    } finally {
      setTranscribing(false)
    }
  }

  const renderMaterial = () => {
    const fileUrl = getFileUrl()

    switch (material.file_type) {
      case 'video':
        const videoExtension = material.file_name.split('.').pop().toLowerCase()
        const videoMimeTypes = {
          'mp4': 'video/mp4',
          'webm': 'video/webm',
          'ogg': 'video/ogg',
          'avi': 'video/x-msvideo',
          'mov': 'video/quicktime',
          'mkv': 'video/x-matroska'
        }
        const videoType = videoMimeTypes[videoExtension] || 'video/mp4'
        
        if (loading) {
          return <div className="loading-file">Загрузка видео...</div>
        }
        
        if (error || !fileBlobUrl) {
          return (
            <div className="error-file">
              <p>{error || 'Не удалось загрузить видео'}</p>
              <a
                href={fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="video-direct-link"
              >
                Попробовать открыть видео напрямую
              </a>
            </div>
          )
        }
        
        return (
          <>
            <div className="video-player-wrapper">
              <video
                controls
                className="video-player"
                preload="metadata"
                loading="lazy"
                onError={(e) => {
                  console.error('Video error:', {
                    src: e.target.src,
                    networkState: e.target.networkState,
                    error: e.target.error,
                    readyState: e.target.readyState
                  })
                }}
              >
                <source src={fileBlobUrl} type={videoType} />
                Ваш браузер не поддерживает воспроизведение видео.
              </video>
            </div>
            <div className="video-actions">
              <button
                className="btn-transcribe"
                onClick={handleTranscribe}
                disabled={transcribing}
                title="Транскрибировать видео"
              >
                {transcribing ? '⏳ Транскрибация...' : '📝 Транскрибация'}
              </button>
            </div>
            {showTranscript && transcript && (
              <div className="transcript-container">
                <div className="transcript-header">
                  <h4>Транскрипт видео</h4>
                  <button
                    className="btn-close-transcript"
                    onClick={() => setShowTranscript(false)}
                    title="Закрыть"
                  >
                    ×
                  </button>
                </div>
                <div className="transcript-content">
                  <p className="transcript-text">{transcript.text}</p>
                </div>
              </div>
            )}
          </>
        )

      case 'pdf':
        return (
          <div className="pdf-viewer-wrapper">
            {loading ? (
              <div className="loading-file">Загрузка и парсинг PDF...</div>
            ) : error ? (
              <div className="error-file">
                <p>{error}</p>
                <a
                  href={fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="pdf-download-link"
                >
                  Открыть PDF в новой вкладке
                </a>
              </div>
            ) : fileText ? (
              <div className="pdf-text-content">
                <div className="pdf-text-header">
                  <span>📄 Текст из PDF:</span>
                  <a
                    href={fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="pdf-view-link"
                  >
                    Открыть оригинал PDF
                  </a>
                </div>
                <div className="pdf-text-body">
                  {fileText.split('\n').map((line, i) => (
                    <p key={i} className={line.startsWith('---') ? 'pdf-page-separator' : 'pdf-text-line'}>
                      {line}
                    </p>
                  ))}
                </div>
              </div>
            ) : (
              <div className="loading-file">Обработка PDF...</div>
            )}
          </div>
        )

      case 'presentation':
        return (
          <div className="presentation-viewer-wrapper">
            <div className="presentation-info">
              <p className="presentation-message">
                📊 Презентация: {material.file_name}
              </p>
              <a
                href={fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="presentation-download-link"
              >
                Открыть презентацию
              </a>
            </div>
          </div>
        )

      case 'audio':
        if (loading) {
          return <div className="loading-file">Загрузка аудио...</div>
        }
        
        if (error || !fileBlobUrl) {
          return (
            <div className="error-file">
              <p>{error || 'Не удалось загрузить аудио'}</p>
            </div>
          )
        }
        
        return (
          <div className="audio-player-wrapper">
            <audio controls className="audio-player">
              <source src={fileBlobUrl} type="audio/mpeg" />
              <source src={fileBlobUrl} type="audio/wav" />
              <source src={fileBlobUrl} type="audio/ogg" />
              Ваш браузер не поддерживает воспроизведение аудио.
            </audio>
          </div>
        )

      case 'scorm':
        return (
          <div className="scorm-viewer-wrapper">
            <div className="scorm-info">
              <p className="scorm-message">
                📦 SCORM пакет: {material.file_name}
              </p>
              <a
                href={fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="scorm-download-link"
              >
                Открыть SCORM пакет
              </a>
            </div>
          </div>
        )

      default:
        // Проверяем, является ли файл Word документом
        if (material.file_name?.endsWith('.docx') || material.file_name?.endsWith('.doc')) {
          return (
            <div className="pdf-viewer-wrapper">
              {loading ? (
                <div className="loading-file">Загрузка и парсинг документа...</div>
              ) : error ? (
                <div className="error-file">
                  <p>{error}</p>
                  <a
                    href={fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="pdf-download-link"
                  >
                    Открыть документ
                  </a>
                </div>
              ) : fileText ? (
                <div className="pdf-text-content">
                  <div className="pdf-text-header">
                    <span>📄 Текст из документа:</span>
                    <a
                      href={fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="pdf-view-link"
                    >
                      Открыть оригинал
                    </a>
                  </div>
                  <div className="pdf-text-body">
                    {fileText.split('\n').map((line, i) => (
                      <p key={i} className="pdf-text-line">
                        {line}
                      </p>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="loading-file">Обработка документа...</div>
              )}
            </div>
          )
        }
        
        return (
          <div className="file-viewer-wrapper">
            <div className="file-info">
              <p className="file-message">
                📎 Файл: {material.file_name}
              </p>
              <a
                href={fileUrl}
                download
                className="file-download-link"
              >
                Скачать файл
              </a>
            </div>
          </div>
        )
    }
  }

  return (
    <div className="material-item-view">
      <div className="material-header">
        <span className="material-number">{index}</span>
        <span className="material-type-badge">{material.file_type}</span>
        <span className="material-filename">{material.file_name}</span>
      </div>
      <div className="material-content">
        {renderMaterial()}
      </div>
    </div>
  )
}

export default LectureView

