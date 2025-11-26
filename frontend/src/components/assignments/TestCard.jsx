import { useState } from 'react'
import api from '../../services/api'
import '../../styles/assignments.css'

function TestCard({ test, lectureId, lecture, role, onTestSubmitted }) {
  const [answers, setAnswers] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [results, setResults] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const handleAnswerChange = (questionId, answer) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }))
  }

  const handleSubmit = async () => {
    // Проверяем, что на все вопросы есть ответы
    const unanswered = test.questions.filter(q => !answers[q.id] && answers[q.id] !== '0')
    if (unanswered.length > 0) {
      alert(`Пожалуйста, ответьте на все вопросы. Не отвечено: ${unanswered.length}`)
      return
    }

    setSubmitting(true)
    try {
      const result = await api.checkTestAnswers(lectureId, answers)
      setResults(result)
      setSubmitted(true)
      // Вызываем callback для обновления попыток в родительском компоненте
      if (onTestSubmitted) {
        onTestSubmitted()
      }
    } catch (err) {
      console.error('Ошибка проверки теста:', err)
      alert(err.message || 'Ошибка при проверке теста. Попробуйте еще раз.')
    } finally {
      setSubmitting(false)
    }
  }

  const isStudent = role === 'student'
  const isTeacher = role === 'teacher' || role === 'admin'

  // Показываем информацию о попытках и дедлайне
  const deadlinePassed = lecture?.test_deadline ? new Date(lecture.test_deadline) < new Date() : false
  
  const attemptsInfo = results ? (
    <div className="test-attempts-info">
      <div className="test-attempts-info-item">
        Использовано попыток: {results.attempts_used || 0} / {results.max_attempts || 1}
      </div>
      {lecture?.test_deadline && (
        <div className={`test-deadline-info-item ${deadlinePassed ? 'deadline-expired' : ''}`}>
          Дедлайн: {new Date(lecture.test_deadline).toLocaleString('ru-RU')}
          {deadlinePassed && (
            <span className="deadline-expired-badge">✓ Истек</span>
          )}
        </div>
      )}
    </div>
  ) : lecture ? (
    <div className="test-attempts-info">
      {lecture.test_max_attempts && (
        <div className="test-attempts-info-item">
          Максимальное количество попыток: {lecture.test_max_attempts}
        </div>
      )}
      {lecture.test_deadline && (
        <div className={`test-deadline-info-item ${deadlinePassed ? 'deadline-expired' : ''}`}>
          Дедлайн: {new Date(lecture.test_deadline).toLocaleString('ru-RU')}
          {deadlinePassed && (
            <span className="deadline-expired-badge">✓ Истек</span>
          )}
        </div>
      )}
    </div>
  ) : null

  return (
    <div className="test-card">
      <div className="test-header">
        <h3 className="test-title">Тест по лекции</h3>
        <div className="test-info">
          <span className="test-questions-count">
            Вопросов: {test.questions.length}
          </span>
        </div>
      </div>
      {attemptsInfo}

      <div className="test-questions">
        {test.questions.map((question, index) => (
          <div key={question.id} className="test-question">
            <div className="question-header">
              <span className="question-number">Вопрос {index + 1}</span>
            </div>
            <p className="question-text">{question.question_text}</p>
            
            {isStudent && !submitted ? (
              <div className="answer-options">
                {(() => {
                  try {
                    const options = question.options ? JSON.parse(question.options) : []
                    return options.map((option, optIndex) => (
                      <label key={optIndex} className="option-label">
                        <input
                          type="radio"
                          name={`question-${question.id}`}
                          value={optIndex}
                          checked={answers[question.id] === String(optIndex)}
                          onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                          className="option-radio"
                        />
                        <span className="option-text">{option}</span>
                      </label>
                    ))
                  } catch (e) {
                    // Если не удалось распарсить options, показываем текстовое поле
                    return (
                      <textarea
                        className="answer-input"
                        placeholder="Введите ваш ответ..."
                        value={answers[question.id] || ''}
                        onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                        rows={3}
                      />
                    )
                  }
                })()}
              </div>
            ) : isTeacher ? (
              <div className="answer-display">
                {(() => {
                  try {
                    const options = question.options ? JSON.parse(question.options) : []
                    return (
                      <div>
                        <div className="options-list">
                          {options.map((option, optIndex) => (
                            <div
                              key={optIndex}
                              className={`option-item ${option === question.correct_answer ? 'option-correct' : ''}`}
                            >
                              {String.fromCharCode(65 + optIndex)}. {option}
                              {option === question.correct_answer && (
                                <span className="correct-badge">✓ Правильный ответ</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  } catch (e) {
                    return (
                      <div className="correct-answer">
                        <strong>Правильный ответ:</strong> {question.correct_answer}
                      </div>
                    )
                  }
                })()}
              </div>
            ) : submitted && results ? (
              <div className="answer-display">
                {(() => {
                  const result = results.results.find(r => r.question_id === question.id)
                  // Показываем ответы если show_answers = true (из ответа API, что означает что дедлайн истек)
                  const showAnswers = results.show_answers === true
                  // Используем правильный ответ из result (если есть), иначе из question
                  // В result.correct_answer правильный ответ будет только если show_answers = true (дедлайн истек)
                  const correctAnswer = (result?.correct_answer && result.correct_answer.trim() !== '') 
                    ? result.correct_answer 
                    : (question.correct_answer || '')
                  
                  try {
                    const options = question.options ? JSON.parse(question.options) : []
                    return (
                      <div>
                        <div className={`student-answer ${result?.is_correct ? 'correct' : 'incorrect'}`}>
                          <strong>Ваш ответ:</strong> {result?.student_answer || 'Не отвечено'}
                        </div>
                        {/* Показываем правильный ответ только если:
                            1. Разрешено показывать (showAnswers = true)
                            2. И ответ студента НЕ правильный (чтобы не дублировать) */}
                        {showAnswers && correctAnswer && !result?.is_correct ? (
                          <div className="options-list">
                            {options.map((option, optIndex) => (
                              <div
                                key={optIndex}
                                className={`option-item ${
                                  option === correctAnswer ? 'option-correct' : ''
                                } ${
                                  result?.student_answer === option && !result?.is_correct ? 'option-incorrect' : ''
                                }`}
                              >
                                {String.fromCharCode(65 + optIndex)}. {option}
                                {option === correctAnswer && (
                                  <span className="correct-badge">✓ Правильный ответ</span>
                                )}
                                {result?.student_answer === option && !result?.is_correct && (
                                  <span className="incorrect-badge">✗ Ваш ответ (неверно)</span>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : showAnswers && !correctAnswer && !result?.is_correct ? (
                          <div className="answers-hidden">
                            Правильный ответ недоступен
                          </div>
                        ) : !showAnswers ? (
                          <div className="answers-hidden">
                            Правильные ответы будут показаны после окончания дедлайна
                          </div>
                        ) : null}
                      </div>
                    )
                  } catch (e) {
                    return (
                      <>
                        <div className={`student-answer ${result?.is_correct ? 'correct' : 'incorrect'}`}>
                          <strong>Ваш ответ:</strong> {result?.student_answer || 'Не отвечено'}
                        </div>
                        {/* Показываем правильный ответ только если ответ студента НЕ правильный */}
                        {showAnswers && correctAnswer && !result?.is_correct ? (
                          <div className="correct-answer">
                            <strong>Правильный ответ:</strong> {correctAnswer}
                          </div>
                        ) : showAnswers && !correctAnswer && !result?.is_correct ? (
                          <div className="answers-hidden">
                            Правильный ответ недоступен
                          </div>
                        ) : !showAnswers ? (
                          <div className="answers-hidden">
                            Правильные ответы будут показаны после окончания дедлайна
                          </div>
                        ) : null}
                      </>
                    )
                  }
                })()}
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {isStudent && !submitted && (
        <div className="test-actions">
          <button
            className="btn-submit-test"
            onClick={handleSubmit}
            disabled={submitting || Object.keys(answers).length < test.questions.length}
          >
            {submitting ? 'Проверка...' : 'Отправить ответы'}
          </button>
        </div>
      )}

      {submitted && results && (
        <div className="test-results">
          <div className="results-header">
            <h4>Результаты теста</h4>
          </div>
          <div className="results-score">
            <span className="score-label">Правильных ответов:</span>
            <span className="score-value">
              {results.correct_answers} из {results.total_questions}
            </span>
          </div>
          <div className="results-percentage">
            <span className="percentage-label">Оценка:</span>
            <span className="percentage-value">
              {typeof results.score === 'number' 
                ? results.score.toFixed(1) 
                : (typeof results.score === 'string' 
                  ? parseFloat(results.score).toFixed(1) 
                  : '0.0')}%
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

export default TestCard

