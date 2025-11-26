import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import api from '../../services/api'
import MultiSelect from '../admin_page/MultiSelect'
import '../../styles/assignments.css'

function AssignmentsTab({ courseId, lectures }) {
  const { role } = useAuth()
  const navigate = useNavigate()
  const [selectedLectureIds, setSelectedLectureIds] = useState([]) // Массив выбранных ID лекций
  const [testList, setTestList] = useState([])
  const [allTestsList, setAllTestsList] = useState([]) // Сохраняем все загруженные тесты
  const [loading, setLoading] = useState(false)

  // Загружаем тесты при изменении списка лекций
  useEffect(() => {
    if (role === 'student') {
      loadAllTests()
    }
  }, [lectures, role, courseId])

  // Фильтруем тесты при изменении выбранных лекций
  useEffect(() => {
    let filtered = allTestsList

    // Фильтр по выбранным лекциям
    if (selectedLectureIds.length > 0) {
      filtered = filtered.filter(test => {
        const testLectureId = typeof test.lectureId === 'string' ? parseInt(test.lectureId) : test.lectureId
        return selectedLectureIds.includes(testLectureId)
      })
    }

    setTestList(filtered)
  }, [selectedLectureIds, allTestsList])

  const loadAllTests = async () => {
    setLoading(true)
    try {
      const allTests = []
      
      // Фильтруем только опубликованные лекции с включенной генерацией теста
      const publishedLectures = lectures.filter(
        lecture => lecture.published && lecture.generate_test
      )
      
      // Загружаем информацию о тестах для каждой лекции
      for (const lecture of publishedLectures) {
        try {
          // Получаем информацию о попытках - это покажет, существует ли тест
          // Если тест существует, будут попытки (или пустой массив, если попыток еще нет)
          // Если тест не существует, будет 404
          let attemptsData = { attempts: [] }
          let testExists = false
          try {
            attemptsData = await api.getTestAttempts(lecture.id)
            // Если попытки получены успешно, значит тест существует
            testExists = true
          } catch (err) {
            // Если тест не найден (404) - пытаемся создать его
            if (err.message && (err.message.includes('404') || err.message.includes('не найден') || err.message.includes('Тест не найден'))) {
              // Тест еще не создан - пытаемся создать его через getLectureTest
              // Это создаст тест для режима "per_student" автоматически
              try {
                await api.getLectureTest(lecture.id)
                // Тест создан, теперь получаем попытки
                try {
                  attemptsData = await api.getTestAttempts(lecture.id)
                  testExists = true
                } catch (err2) {
                  // Если все еще ошибка, пропускаем
                  console.warn(`Не удалось получить попытки после создания теста для лекции ${lecture.id}:`, err2.message)
                  continue
                }
              } catch (err3) {
                // Если не удалось создать тест (403 из-за дедлайна/попыток, 500 и т.д.)
                // Проверяем, может быть тест уже существует, но есть проблемы с доступом
                if (err3.message && err3.message.includes('403') && 
                    (err3.message.includes('дедлайн') || err3.message.includes('попыток'))) {
                  // Тест существует, но дедлайн истек или попытки закончились
                  // Пытаемся получить попытки еще раз
                  try {
                    attemptsData = await api.getTestAttempts(lecture.id)
                    testExists = true
                  } catch (err4) {
                    // Если все еще ошибка, пропускаем
                    continue
                  }
                } else {
                  // Другая ошибка - пропускаем
                  console.warn(`Не удалось создать тест для лекции ${lecture.id}:`, err3.message)
                  continue
                }
              }
            } else {
              // Для других ошибок (403, 500 и т.д.) логируем, но не пропускаем
              // Возможно, тест существует, но есть проблемы с доступом
              console.warn(`Ошибка получения попыток для лекции ${lecture.id}:`, err.message)
              attemptsData = { attempts: [] }
              // Предполагаем, что тест может существовать
              testExists = true
            }
          }
          
          // Если тест не существует, пропускаем
          if (!testExists) {
            continue
          }
          
          // Вычисляем использованные и доступные попытки
          const usedAttempts = attemptsData.attempts?.length || 0
          const maxAttempts = lecture.test_max_attempts || 1
          const remainingAttempts = Math.max(0, maxAttempts - usedAttempts)
          
          // Вычисляем лучшую оценку в процентах (для отображения в списке - округление до целого)
          let bestScorePercent = null
          if (attemptsData.attempts && attemptsData.attempts.length > 0) {
            // Находим лучшую попытку по проценту правильных ответов
            let maxPercent = 0
            attemptsData.attempts.forEach(attempt => {
              // Проверяем, что attempt имеет нужные поля
              if (attempt && typeof attempt.score === 'number' && typeof attempt.total_questions === 'number' && attempt.total_questions > 0) {
                const percent = (attempt.score / attempt.total_questions) * 100
                if (percent > maxPercent) {
                  maxPercent = percent
                }
              }
            })
            // Всегда устанавливаем bestScorePercent, даже если 0 (студент получил 0%)
            // Это позволит отображать оценку даже если студент получил 0%
            bestScorePercent = Math.round(maxPercent) // Округление до целого для списка
          }
          
          // Проверяем статус дедлайна
          // Сохраняем дедлайн как строку для правильного парсинга
          const deadlineString = lecture.test_deadline || null
          // Парсим дедлайн с учетом формата (YYYY-MM-DDTHH:mm или ISO)
          let deadline = null
          if (deadlineString) {
            if (typeof deadlineString === 'string' && deadlineString.includes('T') && !deadlineString.includes('Z') && !deadlineString.includes('+')) {
              // Формат YYYY-MM-DDTHH:mm (локальное время)
              const [datePart, timePart] = deadlineString.split('T')
              deadline = new Date(`${datePart}T${timePart}`)
            } else {
              deadline = new Date(deadlineString)
            }
          }
          const now = new Date()
          const deadlinePassed = deadline ? now > deadline : false
          const hoursUntilDeadline = deadline && !deadlinePassed
            ? (deadline - now) / (1000 * 60 * 60) 
            : null
          const isUrgent = hoursUntilDeadline !== null && hoursUntilDeadline < 24
          
          // Определяем статус теста
          // Если дедлайн истек ИЛИ попытки закончились - статус expired (серый)
          let status = 'available' // available, expired
          if (deadlinePassed || remainingAttempts === 0) {
            status = 'expired'
          }
          
          allTests.push({
            lectureId: lecture.id,
            lectureName: lecture.name,
            deadline: lecture.test_deadline || null, // Сохраняем как строку, а не объект Date
            deadlinePassed: deadlinePassed,
            hoursUntilDeadline: hoursUntilDeadline,
            isUrgent: isUrgent,
            usedAttempts: usedAttempts,
            maxAttempts: maxAttempts,
            remainingAttempts: remainingAttempts,
            status: status,
            hasAttempts: attemptsData.attempts && attemptsData.attempts.length > 0,
            testShowAnswers: lecture.test_show_answers,
            bestScorePercent: bestScorePercent // Лучшая оценка в процентах (округлено до целого для списка)
          })
        } catch (err) {
          // Пропускаем лекции без тестов или с ошибками
          if (!err.message || (!err.message.includes('404') && !err.message.includes('403'))) {
            console.error(`Ошибка загрузки теста для лекции ${lecture.id}:`, err)
          }
        }
      }
      
      // Сортируем по дедлайну (ближайший выше)
      allTests.sort((a, b) => {
        const now = new Date()
        
        // Функция для парсинга дедлайна
        const parseDeadline = (deadlineString) => {
          if (!deadlineString) return null
          if (typeof deadlineString === 'string' && deadlineString.includes('T') && !deadlineString.includes('Z') && !deadlineString.includes('+')) {
            // Формат YYYY-MM-DDTHH:mm (локальное время)
            const [datePart, timePart] = deadlineString.split('T')
            return new Date(`${datePart}T${timePart}`)
          }
          return new Date(deadlineString)
        }
        
        const dateA = a.deadline ? parseDeadline(a.deadline) : null
        const dateB = b.deadline ? parseDeadline(b.deadline) : null
        
        const passedA = dateA ? dateA < now : false
        const passedB = dateB ? dateB < now : false
        
        // Истекшие дедлайны идут в конец
        if (passedA && !passedB) return 1
        if (!passedA && passedB) return -1
        
        // Если оба истекли или оба не истекли, сортируем по дате
        if (passedA && passedB) {
          // Оба истекли - сортируем по убыванию (более свежие истекшие выше)
          return dateB - dateA
        }
        
        // Оба активны - сортируем по возрастанию (ближайший выше)
        if (dateA && dateB) {
          return dateA - dateB
        }
        
        // Если нет дедлайна - в конец
        if (!dateA && !dateB) return 0
        if (!dateA) return 1
        if (!dateB) return -1
        
        return 0
      })
      
      // Сохраняем все загруженные тесты
      setAllTestsList(allTests)
      
      // Применяем фильтр, если выбран
      if (selectedLectureId) {
        const filtered = allTests.filter(test => {
          const testLectureId = typeof test.lectureId === 'string' ? parseInt(test.lectureId) : test.lectureId
          const selectedId = typeof selectedLectureId === 'string' ? parseInt(selectedLectureId) : selectedLectureId
          return testLectureId === selectedId
        })
        setTestList(filtered)
      } else {
        setTestList(allTests)
      }
    } catch (err) {
      console.error('Ошибка загрузки тестов:', err)
      setTestList([])
    } finally {
      setLoading(false)
    }
  }

  const handleTestClick = (test) => {
    // Если дедлайн истек или попыток нет - показываем результаты
    if (test.deadlinePassed || test.remainingAttempts === 0) {
      navigate(`/course/${courseId}/lecture/${test.lectureId}`)
    } else {
      // Иначе открываем тест для прохождения
      navigate(`/course/${courseId}/lecture/${test.lectureId}`)
    }
  }

  // Фильтруем только опубликованные лекции
  const publishedLectures = lectures.filter(lecture => lecture.published && lecture.generate_test)

  if (role !== 'student') {
    // Для преподавателей и админов показываем тесты с дополнительной информацией
    return <TeacherAssignmentsTab courseId={courseId} lectures={lectures} />
  }

  return (
    <div className="assignments-tab">
      <div className="assignments-header">
        <h2 className="assignments-title">Задания</h2>
      </div>

      {/* Фильтр по лекциям с множественным выбором */}
      <div className="assignments-filter">
        <MultiSelect
          options={publishedLectures.map(lecture => ({ id: lecture.id, name: lecture.name }))}
          selectedIds={selectedLectureIds}
          onChange={setSelectedLectureIds}
          placeholder="Выберите лекции..."
          searchPlaceholder="Поиск по названию лекции..."
        />
      </div>

      {/* Список тестов */}
      <div className="assignments-content">
        {loading ? (
          <div className="assignments-loading">Загрузка тестов...</div>
        ) : testList.length > 0 ? (
          <div className="tests-list">
            {testList.map(test => (
              <TestListItem
                key={test.lectureId}
                test={test}
                onClick={() => handleTestClick(test)}
              />
            ))}
          </div>
        ) : (
          <div className="assignments-empty-state">
            <p className="assignments-empty-title">Тесты не найдены</p>
            <p className="assignments-empty-text">
              {publishedLectures.length === 0
                ? 'Нет опубликованных лекций с тестами.'
                : 'Тесты для опубликованных лекций еще не созданы.'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function TestListItem({ test, onClick }) {
  // Функция для парсинга дедлайна (поддерживает формат YYYY-MM-DDTHH:mm и ISO)
  const parseDeadline = (deadlineString) => {
    if (!deadlineString) return null
    // Если это уже объект Date, возвращаем его
    if (deadlineString instanceof Date) return deadlineString
    // Если это не строка, пытаемся преобразовать
    if (typeof deadlineString !== 'string') {
      try {
        return new Date(deadlineString)
      } catch (e) {
        return null
      }
    }
    // Если формат YYYY-MM-DDTHH:mm (локальное время, без таймзоны)
    if (deadlineString.includes('T') && !deadlineString.includes('Z') && !deadlineString.includes('+')) {
      const [datePart, timePart] = deadlineString.split('T')
      return new Date(`${datePart}T${timePart}`)
    }
    // Иначе парсим как ISO или другой формат
    return new Date(deadlineString)
  }

  const formatDeadline = (deadline) => {
    if (!deadline) return 'Без дедлайна'
    const date = parseDeadline(deadline)
    if (!date) return 'Без дедлайна'
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusClass = () => {
    // Проверяем статус напрямую, а также deadlinePassed и remainingAttempts
    const isExpired = test.status === 'expired' || 
                      test.deadlinePassed || 
                      (test.remainingAttempts !== null && test.remainingAttempts === 0)
    
    // Если тест expired, он не может быть urgent
    if (isExpired) {
      return 'test-list-item-expired'
    }
    // Проверяем urgent только если тест не expired
    if (test.isUrgent && !isExpired) {
      return 'test-list-item-urgent'
    }
    return 'test-list-item-normal'
  }

  return (
    <div 
      className={`test-list-item ${getStatusClass()}`}
      onClick={onClick}
    >
      <div className="test-item-header">
        <h3 className="test-item-title">
          Тест по лекции "{test.lectureName}"
        </h3>
        {test.isUrgent && (
          <div className="test-item-urgent-badge" title="Менее 24 часов до дедлайна">
            🔥 Срочно
          </div>
        )}
      </div>
      
      <div className="test-item-info">
        <div className="test-item-deadline">
          <span className="test-item-label">Дедлайн:</span>
          <span className={`test-item-value ${test.deadlinePassed ? 'deadline-expired' : ''}`}>
            {formatDeadline(test.deadline)}
            {test.deadlinePassed && <span className="expired-badge"> (Истек)</span>}
          </span>
        </div>
        
        <div className="test-item-attempts">
          <span className="test-item-label">Попытки:</span>
          <span className={`test-item-value ${test.remainingAttempts === 0 ? 'attempts-exhausted' : ''}`}>
            {test.usedAttempts} / {test.maxAttempts}
          </span>
        </div>
        
        {test.bestScorePercent !== null && test.bestScorePercent !== undefined && (
          <div className="test-item-score">
            <span className="test-item-label">Оценка:</span>
            <div className="test-item-score-badge">
              <span className="test-item-score-value">
                {test.bestScorePercent}%
              </span>
            </div>
          </div>
        )}
      </div>
      
      <div className="test-item-action">
        {test.deadlinePassed || test.remainingAttempts === 0 ? (
          <span className="test-item-action-text">Посмотреть результаты</span>
        ) : (
          <span className="test-item-action-text">Пройти тест</span>
        )}
      </div>
    </div>
  )
}

// Компонент для преподавателя
function TeacherAssignmentsTab({ courseId, lectures }) {
  const [testList, setTestList] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedTest, setSelectedTest] = useState(null)
  const [testDetails, setTestDetails] = useState(null)
  const [loadingDetails, setLoadingDetails] = useState(false)

  useEffect(() => {
    loadTeacherTests()
  }, [lectures, courseId])

  const loadTeacherTests = async () => {
    setLoading(true)
    try {
      const allTests = []
      
      const publishedLectures = lectures.filter(
        lecture => lecture.published && lecture.generate_test
      )
      
      for (const lecture of publishedLectures) {
        try {
          const details = await api.getAllTestAttempts(lecture.id)
          allTests.push({
            lectureId: lecture.id,
            lectureName: lecture.name,
            testMaxAttempts: lecture.test_max_attempts || 1,
            testDeadline: lecture.test_deadline,
            averageScore: details.average_score || 0,
            totalAttempts: details.total_attempts || 0
          })
        } catch (err) {
          // Если тест не найден или нет попыток, все равно добавляем лекцию
          console.log(`Нет данных для лекции ${lecture.id}:`, err.message)
          allTests.push({
            lectureId: lecture.id,
            lectureName: lecture.name,
            testMaxAttempts: lecture.test_max_attempts || 1,
            testDeadline: lecture.test_deadline,
            averageScore: 0,
            totalAttempts: 0
          })
        }
      }
      
      setTestList(allTests)
    } catch (err) {
      console.error('Ошибка загрузки тестов:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleTestClick = async (test) => {
    setSelectedTest(test)
    setLoadingDetails(true)
    try {
      const details = await api.getAllTestAttempts(test.lectureId)
      setTestDetails(details)
    } catch (err) {
      console.error('Ошибка загрузки деталей теста:', err)
      setTestDetails(null)
    } finally {
      setLoadingDetails(false)
    }
  }

  const closeModal = () => {
    setSelectedTest(null)
    setTestDetails(null)
  }

  const parseDeadline = (deadlineString) => {
    if (!deadlineString) return null
    try {
      if (deadlineString.includes('T')) {
        return new Date(deadlineString)
      } else if (deadlineString.includes('-') && deadlineString.includes(':')) {
        return new Date(deadlineString)
      }
      return new Date(deadlineString)
    } catch (e) {
      return null
    }
  }

  return (
    <div className="assignments-tab">
      <div className="assignments-header">
        <h2 className="assignments-title">Задания</h2>
      </div>

      <div className="assignments-content">
        {loading ? (
          <div className="assignments-loading">Загрузка тестов...</div>
        ) : testList.length > 0 ? (
          <div className="tests-list">
            {testList.map(test => (
              <TeacherTestListItem
                key={test.lectureId}
                test={test}
                onClick={() => handleTestClick(test)}
                parseDeadline={parseDeadline}
              />
            ))}
          </div>
        ) : (
          <div className="assignments-empty-state">
            <p className="assignments-empty-title">Тесты не найдены</p>
            <p className="assignments-empty-text">
              {lectures.filter(l => l.published && l.generate_test).length === 0
                ? 'Нет опубликованных лекций с тестами.'
                : 'Тесты для опубликованных лекций еще не созданы.'}
            </p>
          </div>
        )}
      </div>

      {selectedTest && (
        <TeacherTestModal
          test={selectedTest}
          details={testDetails}
          loading={loadingDetails}
          onClose={closeModal}
        />
      )}
    </div>
  )
}

function TeacherTestListItem({ test, onClick, parseDeadline }) {
  const deadline = parseDeadline(test.testDeadline)
  const deadlinePassed = deadline ? deadline < new Date() : false

  return (
    <div className="test-list-item teacher-test-item" onClick={onClick}>
      <div className="test-item-header">
        <h3 className="test-item-title">{test.lectureName}</h3>
      </div>
      <div className="test-item-info">
        <div className="test-item-info-row">
          <span className="test-item-label">Макс. попыток:</span>
          <span className="test-item-value">{test.testMaxAttempts}</span>
        </div>
        {test.testDeadline && (
          <div className="test-item-info-row test-item-deadline-row">
            <span className="test-item-label">
              Дедлайн:
            </span>
            <div className="test-item-deadline-value-wrapper">
              <span className={`test-item-deadline-value ${deadlinePassed ? 'deadline-expired' : 'deadline-active'}`}>
                {deadline?.toLocaleString('ru-RU', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
              {deadlinePassed && (
                <span className="deadline-expired-badge">
                  <span className="deadline-expired-icon">✓</span>
                  Истек
                </span>
              )}
            </div>
          </div>
        )}
        <div className="test-item-info-row">
          <span className="test-item-label">Средняя оценка:</span>
          <span className="test-item-value test-item-average-score">
            {test.averageScore > 0 ? `${test.averageScore.toFixed(1)}%` : '—'}
          </span>
        </div>
        <div className="test-item-info-row">
          <span className="test-item-label">Всего попыток:</span>
          <span className="test-item-value">{test.totalAttempts}</span>
        </div>
      </div>
    </div>
  )
}

function TeacherTestModal({ test, details, loading, onClose }) {
  const [selectedGroupIds, setSelectedGroupIds] = useState([])
  const [selectedStudentIds, setSelectedStudentIds] = useState([])
  const [filteredAttempts, setFilteredAttempts] = useState([])

  useEffect(() => {
    if (details && details.attempts) {
      let filtered = details.attempts

      // Фильтр по группам
      if (selectedGroupIds.length > 0) {
        filtered = filtered.filter(attempt => 
          attempt.group_id && selectedGroupIds.includes(attempt.group_id)
        )
      }

      // Фильтр по студентам
      if (selectedStudentIds.length > 0) {
        filtered = filtered.filter(attempt => 
          selectedStudentIds.includes(attempt.user_id)
        )
      }

      setFilteredAttempts(filtered)
    }
  }, [details, selectedGroupIds, selectedStudentIds])

  // Получаем список студентов для выбранных групп
  const availableStudents = details?.students?.filter(student => {
    if (selectedGroupIds.length === 0) return true
    return selectedGroupIds.includes(student.group_id)
  }) || []

  if (loading) {
    return (
      <div className="teacher-test-modal-overlay" onClick={onClose}>
        <div className="teacher-test-modal-content" onClick={(e) => e.stopPropagation()}>
          <button className="teacher-test-modal-close" onClick={onClose}>×</button>
          <div className="teacher-test-modal-loading">Загрузка данных...</div>
        </div>
      </div>
    )
  }

  if (!details) {
    return (
      <div className="teacher-test-modal-overlay" onClick={onClose}>
        <div className="teacher-test-modal-content" onClick={(e) => e.stopPropagation()}>
          <button className="teacher-test-modal-close" onClick={onClose}>×</button>
          <div className="teacher-test-modal-empty">
            <p>Нет данных о попытках</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="teacher-test-modal-overlay" onClick={onClose}>
      <div className="teacher-test-modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="teacher-test-modal-close" onClick={onClose}>×</button>
        
        <div className="teacher-test-modal-header">
          <h2 className="teacher-test-modal-title">Результаты теста: {test.lectureName}</h2>
          <div className="teacher-test-modal-stats">
            <div className="teacher-test-stat">
              <span className="teacher-test-stat-label">Средняя оценка:</span>
              <span className="teacher-test-stat-value">{details.average_score?.toFixed(1) || 0}%</span>
            </div>
            <div className="teacher-test-stat">
              <span className="teacher-test-stat-label">Всего попыток:</span>
              <span className="teacher-test-stat-value">{details.total_attempts || 0}</span>
            </div>
          </div>
        </div>

        <div className="teacher-test-modal-filters">
          <div className="teacher-test-filter-group">
            <label className="teacher-test-filter-label">Группы:</label>
            <MultiSelect
              options={details.groups || []}
              selectedIds={selectedGroupIds}
              onChange={setSelectedGroupIds}
              placeholder="Выберите группы..."
              searchPlaceholder="Поиск по группам..."
            />
          </div>
          <div className="teacher-test-filter-group">
            <label className="teacher-test-filter-label">Студенты:</label>
            <MultiSelect
              options={availableStudents.map(s => ({ id: s.id, name: `${s.name} (${s.group_name || ''})` }))}
              selectedIds={selectedStudentIds}
              onChange={setSelectedStudentIds}
              placeholder="Выберите студентов..."
              searchPlaceholder="Поиск по студентам..."
            />
          </div>
        </div>

        <div className="teacher-test-modal-attempts">
          {filteredAttempts.length === 0 ? (
            <div className="teacher-test-modal-empty">
              <p>Нет попыток, соответствующих выбранным фильтрам</p>
            </div>
          ) : (
            filteredAttempts.map((attempt, index) => (
              <div key={attempt.id} className="teacher-test-attempt-item">
                <div className="teacher-test-attempt-header">
                  <div className="teacher-test-attempt-student">
                    <h3>{attempt.user_name}</h3>
                    {attempt.group_name && (
                      <span className="teacher-test-attempt-group">{attempt.group_name}</span>
                    )}
                  </div>
                  <div className="teacher-test-attempt-score">
                    Оценка: <strong>{attempt.score.toFixed(1)}</strong> / {attempt.total_questions} 
                    ({((attempt.score / attempt.total_questions) * 100).toFixed(1)}%)
                  </div>
                  <div className="teacher-test-attempt-date">
                    {new Date(attempt.completed_at).toLocaleString('ru-RU')}
                  </div>
                </div>

                {attempt.results && attempt.results.length > 0 && (
                  <div className="teacher-test-attempt-questions">
                    {attempt.results.map((result, qIndex) => (
                      <div key={result.question_id} className="teacher-test-attempt-question">
                        <div className="teacher-test-attempt-question-header">
                          Вопрос {qIndex + 1}
                        </div>
                        <p className="teacher-test-attempt-question-text">{result.question_text}</p>
                        <div className="teacher-test-attempt-answer">
                          <div className={`teacher-test-answer ${result.is_correct ? 'correct' : 'incorrect'}`}>
                            <strong>Ответ студента:</strong> {result.student_answer || 'Не отвечено'}
                            {result.is_correct ? (
                              <span className="teacher-test-answer-badge correct">✓ Правильно</span>
                            ) : (
                              <span className="teacher-test-answer-badge incorrect">✗ Неправильно</span>
                            )}
                          </div>
                          {attempt.show_answers && result.correct_answer && (
                            <div className="teacher-test-correct-answer">
                              <strong>Правильный ответ:</strong> {result.correct_answer}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export default AssignmentsTab

