import { useState, useEffect, useRef } from 'react'
import api from '../../services/api'
import { useAuth } from '../../hooks/useAuth'
import '../../styles/lecture-preview.css'

function LecturePreview({ courseId, lectureId, onClose }) {
  const { getToken } = useAuth()
  const [lecture, setLecture] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const modalRef = useRef(null)

  useEffect(() => {
    loadLecture()
    
    // Закрытие по ESC
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    document.addEventListener('keydown', handleEscape)
    
    // Блокируем скролл body при открытом модальном окне
    document.body.style.overflow = 'hidden'
    
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [lectureId, onClose])

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

  const handleOverlayClick = (e) => {
    if (e.target === modalRef.current) {
      onClose()
    }
  }

  if (loading) {
    return (
      <div className="lecture-preview-overlay" ref={modalRef} onClick={handleOverlayClick}>
        <div className="lecture-preview-modal">
          <div className="loading-state">Загрузка лекции...</div>
        </div>
      </div>
    )
  }

  if (error || !lecture) {
    return (
      <div className="lecture-preview-overlay" ref={modalRef} onClick={handleOverlayClick}>
        <div className="lecture-preview-modal">
          <div className="error-state">{error || 'Лекция не найдена'}</div>
          <button className="btn-close-modal" onClick={onClose}>Закрыть</button>
        </div>
      </div>
    )
  }

  return (
    <div className="lecture-preview-overlay" ref={modalRef} onClick={handleOverlayClick}>
      <div className="lecture-preview-modal">
        <div className="lecture-preview-header">
          <h2 className="lecture-preview-title">{lecture.name}</h2>
          <button className="btn-close-modal" onClick={onClose} title="Закрыть">
            ×
          </button>
        </div>

        <div className="lecture-preview-content">
          {lecture.description && (
            <p className="lecture-preview-description">{lecture.description}</p>
          )}
          {lecture.materials && lecture.materials.length > 0 ? (
            lecture.materials.map((material, index) => (
              <MaterialViewer
                key={material.id}
                material={material}
                index={index + 1}
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

// Компонент для отображения материала (упрощенная версия из LectureView)
function MaterialViewer({ material, index }) {
  const [fileText, setFileText] = useState(null)
  const [fileBlobUrl, setFileBlobUrl] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [transcript, setTranscript] = useState(null)
  const [transcribing, setTranscribing] = useState(false)
  const [showTranscript, setShowTranscript] = useState(false)

  useEffect(() => {
    if (material.file_type === 'pdf' || material.file_name?.endsWith('.docx') || material.file_name?.endsWith('.doc')) {
      loadFileText()
    }
    
    if (material.file_type === 'video' || material.file_type === 'audio') {
      loadFileAsBlob()
    }
    
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
      const token = getToken()
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

      default:
        if (material.file_name?.endsWith('.docx') || material.file_name?.endsWith('.doc')) {
          return (
            <div className="pdf-viewer-wrapper">
              {loading ? (
                <div className="loading-file">Загрузка и парсинг документа...</div>
              ) : error ? (
                <div className="error-file">
                  <p>{error}</p>
                </div>
              ) : fileText ? (
                <div className="pdf-text-content">
                  <div className="pdf-text-header">
                    <span>📄 Текст из документа:</span>
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

export default LecturePreview

