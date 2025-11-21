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
  const [uploading, setUploading] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const isNew = !lecture.id

  const handlePreview = () => {
    if (!lecture.id) {
      alert('Сначала сохраните лекцию, чтобы посмотреть предпросмотр')
      return
    }
    // Открываем предпросмотр в модальном окне
    setShowPreview(true)
  }

  useEffect(() => {
    // Загружаем актуальные данные лекции при открытии конструктора (если это существующая лекция)
    if (!isNew && lecture?.id) {
      const loadLecture = async () => {
        try {
          const updatedLecture = await api.getLecture(lecture.id)
          setName(updatedLecture.name || '')
          setDescription(updatedLecture.description || '')
          setMaterials(updatedLecture.materials || [])
          // Явно проверяем, что published === true (не undefined, не null)
          setPublished(updatedLecture.published === true)
          console.log('Загружена лекция:', { id: updatedLecture.id, published: updatedLecture.published })
        } catch (err) {
          console.error('Ошибка загрузки лекции:', err)
        }
      }
      loadLecture()
    } else if (isNew) {
      // Для новой лекции сбрасываем состояние
      setPublished(false)
    }
  }, [lecture?.id, isNew])

  const ensureLectureCreated = async () => {
    // Если лекция еще не создана, создаем её
    if (isNew && !lecture.id) {
      if (!name.trim()) {
        throw new Error('Название лекции обязательно')
      }
      try {
        const newLecture = await api.createLecture({
          course_id: parseInt(courseId),
          name: name.trim(),
          description: description.trim() || null
        })
        lecture.id = newLecture.id
        // Обновляем состояние, чтобы поля стали disabled
        onUpdate() // Обновляем список лекций
        return newLecture.id
      } catch (err) {
        console.error('Ошибка создания лекции:', err)
        throw err
      }
    }
    return lecture.id
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
      
      {/* Кнопки удаления и публикации лекции (только для существующих лекций) */}
      {!isNew && lecture.id && (
        <div className="lecture-builder-footer">
          {published ? (
            <div className="lecture-builder-published-badge">
              Опубликовано
            </div>
          ) : (
            <button 
              className="btn-publish-lecture" 
              onClick={async (e) => {
                if (!confirm('Выложить лекцию для студентов? Будет выполнена транскрибация видео и парсинг PDF. Это может занять некоторое время.')) {
                  return
                }
                const button = e.target
                const originalText = button.textContent
                button.disabled = true
                button.textContent = '⏳ Обработка...'
                
                try {
                  const response = await api.publishLecture(lecture.id)
                  
                  alert(response.message || 'Лекция успешно опубликована')
                  setPublished(true)
                  
                  // Перезагружаем данные лекции, чтобы получить актуальное состояние
                  try {
                    const updatedLecture = await api.getLecture(lecture.id)
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
                  alert('Ошибка публикации лекции: ' + (err.message || 'Не удалось опубликовать лекцию'))
                  button.disabled = false
                  button.textContent = originalText
                }
              }}
              title="Выложить лекцию"
            >
              📤 Выложить
            </button>
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

