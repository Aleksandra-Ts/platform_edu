import { useState, useEffect } from 'react'
import api from '../../services/api'
import { parseDeadline } from '../../utils/dateUtils'
import '../../styles/grades.css'

function GradesTab({ profile }) {
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedCourses, setExpandedCourses] = useState(new Set())
  const [gpa, setGpa] = useState(null)
  const [selectedLecture, setSelectedLecture] = useState(null)
  const [lectureAttempts, setLectureAttempts] = useState(null)
  const [loadingAttempts, setLoadingAttempts] = useState(false)

  useEffect(() => {
    loadGrades()
  }, [])

  const loadGrades = async () => {
    try {
      setLoading(true)
      const coursesData = await api.getMyCourses()
      const coursesWithGrades = []

      for (const course of coursesData) {
        const lectures = await api.getLectures(course.id)
        const courseGrades = {
          courseId: course.id,
          courseName: course.name,
          lectures: [],
          averageGrade: null
        }

        let totalScore = 0
        let totalQuestions = 0
        let hasGrades = false

        for (const lecture of lectures) {
          if (!lecture.published) continue

          try {
            const attemptsData = await api.getTestAttempts(lecture.id)
            if (attemptsData.attempts && attemptsData.attempts.length > 0) {
              // Находим лучшую попытку
              let bestAttempt = null
              let bestPercent = 0

              attemptsData.attempts.forEach(attempt => {
                if (attempt.total_questions > 0) {
                  const percent = (attempt.score / attempt.total_questions) * 100
                  if (percent > bestPercent) {
                    bestPercent = percent
                    bestAttempt = attempt
                  }
                }
              })

              if (bestAttempt) {
                const grade = (bestAttempt.score / bestAttempt.total_questions) * 100
                courseGrades.lectures.push({
                  lectureId: lecture.id,
                  lectureName: lecture.name || lecture.title || `Лекция ${lecture.id}`,
                  grade: grade.toFixed(1),
                  score: bestAttempt.score,
                  totalQuestions: bestAttempt.total_questions,
                  attemptsData: attemptsData, // Сохраняем все попытки для модального окна
                  lectureData: lecture // Сохраняем данные лекции для модального окна
                })
                totalScore += bestAttempt.score
                totalQuestions += bestAttempt.total_questions
                hasGrades = true
              }
            }
          } catch (err) {
            // Лекция без теста или ошибка - пропускаем
            console.log(`Нет теста для лекции ${lecture.id}:`, err.message)
          }
        }

        if (hasGrades && totalQuestions > 0) {
          courseGrades.averageGrade = ((totalScore / totalQuestions) * 100).toFixed(1)
        }

        if (courseGrades.lectures.length > 0) {
          coursesWithGrades.push(courseGrades)
        }
      }

      setCourses(coursesWithGrades)

      // Вычисляем общий GPA (среднее всех оценок по всем курсам)
      if (coursesWithGrades.length > 0) {
        let totalScore = 0
        let totalQuestions = 0
        
        coursesWithGrades.forEach(course => {
          course.lectures.forEach(lecture => {
            totalScore += lecture.score
            totalQuestions += lecture.totalQuestions
          })
        })
        
        if (totalQuestions > 0) {
          const overallGpa = (totalScore / totalQuestions) * 100
          setGpa(overallGpa.toFixed(1))
        }
      }
    } catch (err) {
      console.error('Ошибка загрузки оценок:', err)
    } finally {
      setLoading(false)
    }
  }

  const toggleCourse = (courseId) => {
    const newExpanded = new Set(expandedCourses)
    if (newExpanded.has(courseId)) {
      newExpanded.delete(courseId)
    } else {
      newExpanded.add(courseId)
    }
    setExpandedCourses(newExpanded)
  }

  const handleLectureClick = async (lecture) => {
    setSelectedLecture(lecture)
    setLoadingAttempts(true)
    try {
      // Загружаем попытки для выбранной лекции (чтобы получить актуальные данные)
      const attemptsData = await api.getTestAttempts(lecture.lectureId)
      setLectureAttempts(attemptsData)
    } catch (err) {
      console.error('Ошибка загрузки попыток:', err)
      // Используем сохраненные данные, если они есть
      if (lecture.attemptsData) {
        setLectureAttempts(lecture.attemptsData)
      } else {
        setLectureAttempts(null)
      }
    } finally {
      setLoadingAttempts(false)
    }
  }

  const closeModal = () => {
    setSelectedLecture(null)
    setLectureAttempts(null)
  }

  if (loading) {
    return (
      <div className="grades-container">
        <div className="loading-state">Загрузка оценок...</div>
      </div>
    )
  }

  if (courses.length === 0) {
    return (
      <div className="grades-container">
        <div className="empty-state">
          <p>У вас пока нет оценок</p>
          <p className="hint">Оценки появятся после прохождения тестов</p>
        </div>
      </div>
    )
  }

  return (
    <div className="grades-container">
      <div className="grades-header-panel">
        <div className="grades-student-info">
          <div className="grades-student-name">
            {profile?.full_name || profile?.login || 'Студент'}
          </div>
        </div>
        <div className="grades-gpa-section">
          <div className="grades-gpa-label">Средний балл</div>
          <div className="grades-gpa-value">{gpa || '—'}%</div>
        </div>
      </div>

      <div className="grades-list">
        {courses.map(course => (
          <div key={course.courseId} className="grades-course-item">
            <div 
              className="grades-course-header"
              onClick={() => toggleCourse(course.courseId)}
            >
              <div className="grades-course-info">
                <span className="grades-course-name">{course.courseName}</span>
                <span className="grades-course-average">
                  Средняя оценка: {course.averageGrade || '—'}%
                </span>
              </div>
              <div className="grades-expand-icon">
                {expandedCourses.has(course.courseId) ? '▼' : '▶'}
              </div>
            </div>
            
            {expandedCourses.has(course.courseId) && (
              <div className="grades-lectures-list">
                {course.lectures.length === 0 ? (
                  <div className="grades-no-lectures">Нет оценок по лекциям</div>
                ) : (
                  course.lectures.map(lecture => (
                    <div 
                      key={lecture.lectureId} 
                      className="grades-lecture-item"
                      onClick={() => handleLectureClick(lecture)}
                    >
                      <div className="grades-lecture-name" title={lecture.lectureName}>
                        {lecture.lectureName || `Лекция ${lecture.lectureId}`}
                      </div>
                      <div className="grades-lecture-grade">
                        <span className="grades-grade-value">{lecture.grade}%</span>
                        <span className="grades-grade-detail">
                          ({lecture.score}/{lecture.totalQuestions})
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {selectedLecture && (
        <div className="grades-modal-overlay" onClick={closeModal}>
          <div className="grades-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="grades-modal-close" onClick={closeModal}>×</button>
            {loadingAttempts ? (
              <div className="grades-modal-loading">Загрузка результатов...</div>
            ) : (
              <TestResultsModal 
                lecture={selectedLecture}
                attempts={lectureAttempts}
                onClose={closeModal}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function TestResultsModal({ lecture, attempts, onClose }) {
  // Получаем данные лекции для проверки дедлайна и настроек показа ответов
  const lectureData = lecture.lectureData || {}
  // Используем parseDeadline из утилит
  
  const deadlinePassed = lectureData.test_deadline ? parseDeadline(lectureData.test_deadline) < new Date() : false
  const shouldShowAnswers = lectureData.test_show_answers && deadlinePassed

  if (!attempts || !attempts.attempts || attempts.attempts.length === 0) {
    return (
      <div className="grades-modal-body">
        <h2 className="grades-modal-title">Результаты теста: {lecture.lectureName}</h2>
        <div className="grades-modal-empty">
          ⚠️ У вас нет попыток прохождения теста.
        </div>
      </div>
    )
  }

  return (
    <div className="grades-modal-body">
      <h2 className="grades-modal-title">Результаты теста: {lecture.lectureName}</h2>
      
      <div className="grades-modal-attempts">
        {attempts.attempts.map((attempt, attemptIndex) => (
          <div key={attempt.id} className="grades-modal-attempt">
            <div className="grades-modal-attempt-header">
              <h3 className="grades-modal-attempt-title">
                Попытка {attemptIndex + 1}
              </h3>
              <div className="grades-modal-attempt-score">
                Оценка: <strong>{attempt.score.toFixed(1)}</strong> / {attempt.total_questions} 
                ({((attempt.score / attempt.total_questions) * 100).toFixed(1)}%)
              </div>
              <div className="grades-modal-attempt-date">
                Дата: {new Date(attempt.completed_at).toLocaleString('ru-RU')}
              </div>
            </div>

            {attempt.results && attempt.results.length > 0 && (
              <div className="grades-modal-questions">
                {attempt.results.map((result, qIndex) => (
                  <div key={result.question_id} className="grades-modal-question">
                    <div className="grades-modal-question-header">
                      Вопрос {qIndex + 1}
                    </div>
                    <p className="grades-modal-question-text">{result.question_text}</p>
                    
                    <div className="grades-modal-answer-comparison">
                      <div className={`grades-modal-student-answer ${result.is_correct ? 'correct' : 'incorrect'}`}>
                        <strong>Ваш ответ:</strong> {result.student_answer || 'Не отвечено'}
                        {result.is_correct ? (
                          <span className="grades-modal-correct-badge">✓ Правильно</span>
                        ) : (
                          <span className="grades-modal-incorrect-badge">✗ Неправильно</span>
                        )}
                      </div>
                      
                      {(() => {
                        const canShow = (attempt.show_answers !== undefined ? attempt.show_answers : shouldShowAnswers)
                        const correctAnswer = result.correct_answer || ''
                        
                        // Показываем правильный ответ только если:
                        // - Разрешено показывать
                        // - Есть правильный ответ
                        // - И ответ студента НЕ правильный (чтобы не дублировать)
                        if (canShow && correctAnswer && !result.is_correct) {
                          return (
                            <div className="grades-modal-correct-answer">
                              <strong>Правильный ответ:</strong> {correctAnswer}
                            </div>
                          )
                        }
                        return null
                      })()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default GradesTab

