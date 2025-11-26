import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'
import LecturePreview from './LecturePreview'

function LectureBuilder({ lecture, courseId, onClose, onUpdate, onDelete }) {
  const navigate = useNavigate()
  const [name, setName] = useState(lecture?.name || '')
  const [description, setDescription] = useState(lecture?.description || '')
  const [materials, setMaterials] = useState(lecture?.materials || [])
  const [published, setPublished] = useState(lecture?.published === true)
  const [generateTest, setGenerateTest] = useState(lecture?.generate_test || false)
  const [testGenerationMode, setTestGenerationMode] = useState(lecture?.test_generation_mode || 'once')
  const [testMaxAttempts, setTestMaxAttempts] = useState(lecture?.test_max_attempts || 1)
  const [testShowAnswers, setTestShowAnswers] = useState(lecture?.test_show_answers || false)
  const [testDeadline, setTestDeadline] = useState(lecture?.test_deadline || '')
  const [uploading, setUploading] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [lectureId, setLectureId] = useState(lecture?.id)
  const [publishing, setPublishing] = useState(false)
  const [publishProgress, setPublishProgress] = useState(0)
  const isNew = !lectureId

  const handlePreview = () => {
    if (!lecture.id) {
      alert('Сначала сохраните лекцию, чтобы посмотреть предпросмотр')
      return
    }
    // Открываем предпросмотр в модальном окне
    setShowPreview(true)
  }

  useEffect(() => {
    // Обновляем lectureId при изменении lecture
    if (lecture?.id) {
      setLectureId(lecture.id)
    }
    
    // Загружаем актуальные данные лекции при открытии конструктора (если это существующая лекция)
    if (lecture?.id) {
      const loadLecture = async () => {
        try {
          const updatedLecture = await api.getLecture(lecture.id)
          setName(updatedLecture.name || '')
          setDescription(updatedLecture.description || '')
          setMaterials(updatedLecture.materials || [])
          setPublished(updatedLecture.published === true)
          setGenerateTest(updatedLecture.generate_test || false)
          setTestGenerationMode(updatedLecture.test_generation_mode || 'once')
          setTestMaxAttempts(updatedLecture.test_max_attempts || 1)
          setTestShowAnswers(updatedLecture.test_show_answers || false)
          setTestDeadline(updatedLecture.test_deadline || '')
          setLectureId(updatedLecture.id)
          console.log('Загружена лекция:', { id: updatedLecture.id, published: updatedLecture.published })
        } catch (err) {
          console.error('Ошибка загрузки лекции:', err)
        }
      }
      loadLecture()
    } else {
      // Для новой лекции сбрасываем состояние
      setPublished(false)
      setLectureId(null)
    }
  }, [lecture?.id])

  const ensureLectureCreated = async () => {
    // Если лекция еще не создана, создаем её
    if (isNew && !lectureId) {
      if (!name.trim()) {
        throw new Error('Название лекции обязательно')
      }
      try {
        const newLecture = await api.createLecture({
          course_id: parseInt(courseId),
          name: name.trim(),
          description: description.trim() || null,
          generate_test: generateTest,
          test_generation_mode: testGenerationMode,
          test_max_attempts: testMaxAttempts,
          test_show_answers: testShowAnswers,
          test_deadline: testDeadline || null
        })
        setLectureId(newLecture.id)
        if (lecture) {
          lecture.id = newLecture.id
        }
        // Обновляем состояние, чтобы поля стали disabled
        onUpdate() // Обновляем список лекций
        return newLecture.id
      } catch (err) {
        console.error('Ошибка создания лекции:', err)
        throw err
      }
    }
    return lectureId || lecture?.id
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    try {
      setUploading(true)
      
      // Если это новая лекция, сначала создаем её
      const lectureId = await ensureLectureCreated()
      
      const material = await api.uploadMaterial(lectureId, file)
      setMaterials([...materials, material])
      onUpdate()
    } catch (err) {
      alert('Ошибка: ' + err.message)
    } finally {
      setUploading(false)
      e.target.value = '' // Сброс input
    }
  }

  const handleDeleteMaterial = async (materialId) => {
    if (!confirm('Удалить этот материал?')) return

    try {
      const lectureId = await ensureLectureCreated()
      await api.deleteMaterial(lectureId, materialId)
      setMaterials(materials.filter(m => m.id !== materialId))
      onUpdate()
    } catch (err) {
      alert('Ошибка удаления материала: ' + err.message)
    }
  }

  const handleMoveUp = async (index) => {
    if (index === 0) return
    const newMaterials = [...materials]
    ;[newMaterials[index - 1], newMaterials[index]] = [newMaterials[index], newMaterials[index - 1]]
    setMaterials(newMaterials)
    
    try {
      const lectureId = await ensureLectureCreated()
      await api.reorderMaterials(lectureId, newMaterials.map(m => m.id))
      onUpdate()
    } catch (err) {
      alert('Ошибка изменения порядка: ' + err.message)
    }
  }

  const handleMoveDown = async (index) => {
    if (index === materials.length - 1) return
    const newMaterials = [...materials]
    ;[newMaterials[index], newMaterials[index + 1]] = [newMaterials[index + 1], newMaterials[index]]
    setMaterials(newMaterials)
    
    try {
      const lectureId = await ensureLectureCreated()
      await api.reorderMaterials(lectureId, newMaterials.map(m => m.id))
      onUpdate()
    } catch (err) {
      alert('Ошибка изменения порядка: ' + err.message)
    }
  }

  const getFileTypeIcon = (fileType) => {
    const icons = {
      video: '🎥',
      pdf: '📄',
      presentation: '📊',
      audio: '🎵',
      scorm: '📦',
      other: '📎'
    }
    return icons[fileType] || icons.other
  }

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  return (
    <div className="lecture-builder">
      <div className="lecture-builder-header">
        <h3>{isNew ? 'Создание новой лекции' : `Конструктор лекции: ${lecture.name}`}</h3>
        <div className="builder-actions">
          {!isNew && (
            <>
              <button 
                className="btn-preview btn-icon-preview" 
                onClick={handlePreview}
                title="Предпросмотр лекции (как видит ученик)"
              >
                👁️
              </button>
              <button className="btn-outline" onClick={onClose}>Закрыть</button>
            </>
          )}
        </div>
      </div>

      <div className="lecture-builder-form">
        <div className="form-field">
          <label>Название лекции *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Введите название лекции"
            required
            disabled={!isNew || !!lecture.id}
          />
        </div>
        <div className="form-field">
          <label>Описание</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Введите описание лекции"
            rows="3"
            disabled={!isNew || !!lecture.id}
          />
        </div>
        
        {isNew && !lecture.id && (
          <p className="hint-text">
            💡 Введите название и описание, затем загрузите материалы. Лекция будет создана автоматически при первой загрузке файла.
          </p>
        )}
      </div>

      <div className="materials-section">
        <div className="materials-header">
          <h4>Материалы лекции</h4>
          <label className="file-upload-btn">
            <input
              type="file"
              onChange={handleFileUpload}
              disabled={uploading}
              accept=".mp4,.avi,.mov,.mkv,.webm,.pdf,.pptx,.ppt,.mp3,.wav,.ogg,.m4a,.zip"
            />
            {uploading ? 'Загрузка...' : '+ Загрузить материал'}
          </label>
        </div>

        <div className="materials-list">
          {materials.length === 0 ? (
            <div className="empty-materials">
              <p>Материалы не добавлены</p>
              <p className="hint">Загрузите видео, PDF, презентации, аудио или SCORM пакеты</p>
            </div>
          ) : (
            materials.map((material, index) => (
              <div key={material.id} className="material-item">
                <div className="material-icon">{getFileTypeIcon(material.file_type)}</div>
                <div className="material-info">
                  <div className="material-name">{material.file_name}</div>
                  <div className="material-meta">
                    <span className="material-type">{material.file_type}</span>
                    <span className="material-size">{formatFileSize(material.file_size)}</span>
                  </div>
                </div>
                <div className="material-actions">
                  <button
                    className="btn-icon"
                    onClick={() => handleMoveUp(index)}
                    disabled={index === 0}
                    title="Вверх"
                  >
                    ↑
                  </button>
                  <button
                    className="btn-icon"
                    onClick={() => handleMoveDown(index)}
                    disabled={index === materials.length - 1}
                    title="Вниз"
                  >
                    ↓
                  </button>
                  <button
                    className="btn-icon delete"
                    onClick={() => handleDeleteMaterial(material.id)}
                    title="Удалить"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      
      {/* Настройки генерации теста (только для существующих лекций) */}
      {!isNew && lecture.id && (
        <div className="test-settings-section">
          <div className="test-settings-header">
            <h4>Настройки теста</h4>
            <p className="test-settings-description">
              Настройте автоматическую генерацию теста на основе материалов лекции
              {published && (
                <span className="test-settings-editable-hint">
                  {' '}✓ Параметры теста можно изменять после публикации
                </span>
              )}
            </p>
          </div>
          
          <div className="test-settings-content">
            <div className="test-settings-main">
              <label className="test-settings-toggle">
                <input
                  type="checkbox"
                  checked={generateTest}
                  onChange={(e) => {
                    setGenerateTest(e.target.checked)
                    // Автосохранение при изменении
                    if (lecture.id) {
                      api.updateLecture(lecture.id, {
                        generate_test: e.target.checked,
                        test_generation_mode: testGenerationMode,
                        test_max_attempts: testMaxAttempts,
                        test_show_answers: testShowAnswers,
                        test_deadline: testDeadline || null
                      }).catch(err => console.error('Ошибка сохранения:', err))
                    }
                  }}
                  className="test-settings-checkbox-large"
                />
                <span className="test-settings-toggle-label">
                  <span className="test-settings-toggle-text">
                    <strong>Генерировать тест по лекции</strong>
                    <span className="test-settings-toggle-hint">Автоматически создавать тест на основе материалов</span>
                  </span>
                </span>
              </label>
            </div>
            
            {generateTest && (
              <div className="test-settings-options">
                <div className="test-settings-option">
                  <label className="test-settings-option-label">
                    Режим генерации теста
                    {published && testGenerationMode === 'once' && (
                      <span className="test-settings-warning-badge" title="Внимание: изменение режима после публикации может повлиять на уже созданные тесты">
                        ⚠️
                      </span>
                    )}
                  </label>
                  <select
                    value={testGenerationMode}
                    onChange={(e) => {
                      if (published && testGenerationMode === 'once' && e.target.value === 'per_student') {
                        if (!confirm('Внимание! Изменение режима генерации теста после публикации может повлиять на уже созданные тесты. Продолжить?')) {
                          return
                        }
                      }
                      setTestGenerationMode(e.target.value)
                      if (lecture.id) {
                        api.updateLecture(lecture.id, {
                          generate_test: generateTest,
                          test_generation_mode: e.target.value,
                          test_max_attempts: testMaxAttempts,
                          test_show_answers: testShowAnswers,
                          test_deadline: testDeadline || null
                        }).catch(err => console.error('Ошибка сохранения:', err))
                      }
                    }}
                    className="test-settings-select"
                  >
                    <option value="once">Один раз (при публикации)</option>
                    <option value="per_student">Новый тест для каждого студента</option>
                  </select>
                  <span className="test-settings-option-hint">
                    {testGenerationMode === 'once' 
                      ? 'Все студенты получат одинаковый тест' 
                      : 'Каждый студент получит уникальный тест'}
                    {published && (
                      <span className="test-settings-editable-indicator"> (можно изменить)</span>
                    )}
                  </span>
                </div>
                
                <div className="test-settings-option">
                  <label className="test-settings-option-label">
                    Максимальное количество попыток
                    {published && (
                      <span className="test-settings-editable-badge" title="Можно изменить после публикации">
                        ✏️
                      </span>
                    )}
                  </label>
                  <div className="test-settings-input-group">
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={testMaxAttempts}
                      onChange={(e) => {
                        const value = parseInt(e.target.value) || 1
                        setTestMaxAttempts(value)
                        if (lecture.id) {
                          api.updateLecture(lecture.id, {
                            generate_test: generateTest,
                            test_generation_mode: testGenerationMode,
                            test_max_attempts: value,
                            test_show_answers: testShowAnswers,
                            test_deadline: testDeadline || null
                          }).catch(err => {
                            console.error('Ошибка сохранения:', err)
                            alert('Ошибка сохранения параметров теста: ' + err.message)
                          })
                        }
                      }}
                      className="test-settings-input-number"
                    />
                    <span className="test-settings-input-suffix">попыток</span>
                  </div>
                  <span className="test-settings-option-hint">
                    Сколько раз студент может пройти тест
                    {published && (
                      <span className="test-settings-editable-indicator"> (можно изменить)</span>
                    )}
                  </span>
                </div>
                
                <div className="test-settings-option">
                  <label className="test-settings-option-label">
                    <input
                      type="checkbox"
                      checked={testShowAnswers}
                      onChange={(e) => {
                        setTestShowAnswers(e.target.checked)
                        if (lecture.id) {
                          api.updateLecture(lecture.id, {
                            generate_test: generateTest,
                            test_generation_mode: testGenerationMode,
                            test_max_attempts: testMaxAttempts,
                            test_show_answers: e.target.checked,
                            test_deadline: testDeadline || null
                          }).catch(err => console.error('Ошибка сохранения:', err))
                        }
                      }}
                      className="test-settings-checkbox"
                    />
                    <span>Показывать правильные ответы после дедлайна</span>
                  </label>
                  <span className="test-settings-option-hint">
                    Правильные ответы будут доступны только после окончания дедлайна
                  </span>
                </div>
                
                <div className="test-settings-option">
                  <label className="test-settings-option-label">
                    Дедлайн выполнения теста
                    {published && (
                      <span className="test-settings-editable-badge" title="Можно изменить после публикации">
                        ✏️
                      </span>
                    )}
                  </label>
                  <div className="test-settings-deadline-widget">
                    <div className="test-settings-deadline-inputs">
                      <div className="test-settings-date-input-wrapper">
                        <label className="test-settings-date-label">
                          <span className="test-settings-date-icon">📅</span>
                          <span>Дата</span>
                        </label>
                        <input
                          type="date"
                          value={testDeadline ? (testDeadline.includes('T') ? testDeadline.split('T')[0] : new Date(testDeadline).toISOString().slice(0, 10)) : ''}
                          onChange={(e) => {
                            const dateValue = e.target.value
                            if (dateValue) {
                              const timeValue = testDeadline ? new Date(testDeadline).toTimeString().slice(0, 5) : '23:59'
                              // Сохраняем в формате YYYY-MM-DDTHH:mm (локальное время, без UTC)
                              const newDateTime = `${dateValue}T${timeValue}`
                              setTestDeadline(newDateTime)
                              if (lecture.id) {
                                api.updateLecture(lecture.id, {
                                  generate_test: generateTest,
                                  test_generation_mode: testGenerationMode,
                                  test_max_attempts: testMaxAttempts,
                                  test_show_answers: testShowAnswers,
                                  test_deadline: newDateTime
                                }).catch(err => console.error('Ошибка сохранения:', err))
                              }
                            } else {
                              setTestDeadline('')
                              if (lecture.id) {
                                api.updateLecture(lecture.id, {
                                  generate_test: generateTest,
                                  test_generation_mode: testGenerationMode,
                                  test_max_attempts: testMaxAttempts,
                                  test_show_answers: testShowAnswers,
                                  test_deadline: null
                                }).catch(err => console.error('Ошибка сохранения:', err))
                              }
                            }
                          }}
                          className="test-settings-date-input"
                          min={new Date().toISOString().slice(0, 10)}
                        />
                      </div>
                      
                      <div className="test-settings-time-input-wrapper">
                        <label className="test-settings-time-label">
                          <span className="test-settings-time-icon">🕐</span>
                          <span>Время</span>
                        </label>
                        <input
                          type="time"
                          value={testDeadline ? (testDeadline.includes('T') ? testDeadline.split('T')[1]?.slice(0, 5) || '' : new Date(testDeadline).toTimeString().slice(0, 5)) : ''}
                          onChange={(e) => {
                            const timeValue = e.target.value
                            if (timeValue && testDeadline) {
                              // Извлекаем дату из существующего дедлайна (может быть в формате ISO или YYYY-MM-DDTHH:mm)
                              const dateValue = testDeadline.includes('T') 
                                ? testDeadline.split('T')[0] 
                                : new Date(testDeadline).toISOString().slice(0, 10)
                              // Сохраняем в формате YYYY-MM-DDTHH:mm (локальное время, без UTC)
                              const newDateTime = `${dateValue}T${timeValue}`
                              setTestDeadline(newDateTime)
                              if (lecture.id) {
                                api.updateLecture(lecture.id, {
                                  generate_test: generateTest,
                                  test_generation_mode: testGenerationMode,
                                  test_max_attempts: testMaxAttempts,
                                  test_show_answers: testShowAnswers,
                                  test_deadline: newDateTime
                                }).catch(err => console.error('Ошибка сохранения:', err))
                              }
                            } else if (timeValue) {
                              // Если есть время, но нет даты, устанавливаем сегодняшнюю дату
                              const today = new Date().toISOString().slice(0, 10)
                              // Сохраняем в формате YYYY-MM-DDTHH:mm (локальное время, без UTC)
                              const newDateTime = `${today}T${timeValue}`
                              setTestDeadline(newDateTime)
                              if (lecture.id) {
                                api.updateLecture(lecture.id, {
                                  generate_test: generateTest,
                                  test_generation_mode: testGenerationMode,
                                  test_max_attempts: testMaxAttempts,
                                  test_show_answers: testShowAnswers,
                                  test_deadline: newDateTime
                                }).catch(err => console.error('Ошибка сохранения:', err))
                              }
                            }
                          }}
                          className="test-settings-time-input"
                          disabled={!testDeadline}
                        />
                      </div>
                      
                      {testDeadline && (
                        <button
                          type="button"
                          onClick={() => {
                            setTestDeadline('')
                            if (lecture.id) {
                              api.updateLecture(lecture.id, {
                                generate_test: generateTest,
                                test_generation_mode: testGenerationMode,
                                test_max_attempts: testMaxAttempts,
                                test_show_answers: testShowAnswers,
                                test_deadline: null
                              }).catch(err => console.error('Ошибка сохранения:', err))
                            }
                          }}
                          className="test-settings-remove-deadline"
                          title="Убрать дедлайн"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    {testDeadline && (
                      <div className="test-settings-deadline-preview">
                        <span className="test-settings-deadline-preview-icon">⏰</span>
                        <span className="test-settings-deadline-preview-text">
                          Дедлайн: {(() => {
                            // Парсим дедлайн (может быть в формате YYYY-MM-DDTHH:mm или ISO)
                            let date
                            if (testDeadline.includes('T') && !testDeadline.includes('Z') && !testDeadline.includes('+')) {
                              // Формат YYYY-MM-DDTHH:mm (локальное время)
                              const [datePart, timePart] = testDeadline.split('T')
                              date = new Date(`${datePart}T${timePart}`)
                            } else {
                              date = new Date(testDeadline)
                            }
                            return date.toLocaleString('ru-RU', {
                              day: '2-digit',
                              month: 'long',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })
                          })()}
                        </span>
                      </div>
                    )}
                  </div>
                  <span className="test-settings-option-hint">
                    После дедлайна тест будет недоступен для прохождения
                    {published && (
                      <span className="test-settings-editable-indicator"> (можно изменить)</span>
                    )}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Кнопки удаления и публикации лекции (только для существующих лекций) */}
      {!isNew && lecture.id && (
        <>
          <div className="lecture-builder-footer">
          {published ? (
            <div className="lecture-builder-published-badge">
              Опубликовано
            </div>
          ) : (
            <button 
              className="btn-publish-lecture" 
              disabled={!lectureId || isNew || !materials || materials.length === 0}
              onClick={async (e) => {
                // Проверяем, что лекция создана
                const currentLectureId = lectureId || lecture?.id
                if (!currentLectureId) {
                  alert('Сначала сохраните лекцию, чтобы её можно было опубликовать')
                  return
                }
                
                // Проверяем, что есть материалы
                if (!materials || materials.length === 0) {
                  alert('Добавьте хотя бы один материал (видео, PDF, DOCX) перед публикацией')
                  return
                }
                
                if (!confirm('Выложить лекцию для студентов? Будет выполнена транскрибация видео и парсинг PDF. Это может занять некоторое время.')) {
                  return
                }
                
                const button = e.target
                const originalText = button.textContent
                button.disabled = true
                setPublishing(true)
                setPublishProgress(0)
                
                // Симуляция прогресса (будет заменено на реальный прогресс с SSE)
                const progressInterval = setInterval(() => {
                  setPublishProgress(prev => {
                    if (prev >= 90) return prev
                    return prev + Math.random() * 10
                  })
                }, 500)
                
                try {
                  const currentLectureId = lectureId || lecture?.id
                  console.log('Публикация лекции:', { lectureId: currentLectureId, materialsCount: materials.length })
                  const response = await api.publishLecture(currentLectureId)
                  
                  clearInterval(progressInterval)
                  setPublishProgress(100)
                  
                  console.log('Ответ от сервера:', response)
                  alert(response.message || 'Лекция успешно опубликована')
                  setPublished(true)
                  
                  // Перезагружаем данные лекции, чтобы получить актуальное состояние
                  try {
                    const currentLectureId = lectureId || lecture?.id
                    const updatedLecture = await api.getLecture(currentLectureId)
                    setPublished(updatedLecture.published === true)
                    console.log('После публикации - published:', updatedLecture.published)
                  } catch (err) {
                    console.error('Ошибка обновления данных лекции:', err)
                  }
                  
                  // Обновляем данные лекции
                  if (onUpdate) {
                    onUpdate()
                  }
                } catch (err) {
                  clearInterval(progressInterval)
                  setPublishProgress(0)
                  console.error('Ошибка публикации лекции:', err)
                  const errorMessage = err.response?.data?.detail || err.message || 'Не удалось опубликовать лекцию'
                  alert('Ошибка публикации лекции: ' + errorMessage)
                  button.disabled = false
                  button.textContent = originalText
                } finally {
                  setPublishing(false)
                }
              }}
              title={!lectureId ? "Сначала сохраните лекцию" : materials.length === 0 ? "Добавьте материалы" : "Выложить лекцию"}
            >
              📤 Выложить
            </button>
          )}
          {publishing && (
            <div className="publish-progress-container">
              <div className="publish-progress-bar">
                <div 
                  className="publish-progress-fill" 
                  style={{ width: `${publishProgress}%` }}
                ></div>
              </div>
              <div className="publish-progress-text">
                Обработка... {Math.round(publishProgress)}%
              </div>
            </div>
          )}
          <button 
            className="btn-delete-lecture" 
            onClick={async () => {
              if (!confirm('Вы уверены, что хотите удалить эту лекцию? Это действие нельзя отменить.')) {
                return
              }
              try {
                await api.deleteLecture(lecture.id)
                if (onDelete) {
                  onDelete()
                } else {
                  onClose()
                }
              } catch (err) {
                alert('Ошибка удаления лекции: ' + (err.message || 'Не удалось удалить лекцию'))
              }
            }}
            title="Удалить лекцию"
          >
            🗑️ Удалить лекцию
          </button>
          </div>
        </>
      )}

      {/* Модальное окно для предпросмотра */}
      {showPreview && lecture.id && (
        <LecturePreview
          courseId={courseId}
          lectureId={lecture.id}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  )
}

export default LectureBuilder

