import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../services/api'
import '../styles/lecture-view.css'

function LectureView() {
  const { courseId, lectureId } = useParams()
  const navigate = useNavigate()
  const [lecture, setLecture] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadLecture()
  }, [lectureId])

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

  const handleBack = () => {
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
            <span className="breadcrumb-item" onClick={handleBack}>
              Курс
            </span>
            <span className="breadcrumb-separator">/</span>
            <span className="breadcrumb-item active">{lecture.name}</span>
          </div>
        </div>

        <h1 className="lecture-view-title">{lecture.name}</h1>
        {lecture.description && (
          <p className="lecture-view-description">{lecture.description}</p>
        )}

        <div className="lecture-materials-view">
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

function MaterialViewer({ material, index }) {
  const [fileText, setFileText] = useState(null)
  const [fileBlobUrl, setFileBlobUrl] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

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
      } else if (response.error) {
        setError(response.error)
      }
    } catch (err) {
      console.error('Ошибка загрузки содержимого файла:', err)
      setError('Не удалось загрузить содержимое файла.')
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
                style={{ color: '#0f6b51', textDecoration: 'underline', marginTop: '1rem', display: 'inline-block' }}
              >
                Попробовать открыть видео напрямую
              </a>
            </div>
          )
        }
        
        return (
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
                    <p key={i} style={{ margin: line.startsWith('---') ? '1rem 0 0.5rem 0' : '0.25rem 0' }}>
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
                      <p key={i} style={{ margin: '0.5rem 0' }}>
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

