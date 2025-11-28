import './AlertDialog.css'

/**
 * Компонент диалога для показа сообщений
 * @param {boolean} isOpen - Открыт ли диалог
 * @param {string} title - Заголовок диалога
 * @param {string} message - Сообщение диалога
 * @param {string} buttonText - Текст кнопки (по умолчанию "OK")
 * @param {Function} onClose - Обработчик закрытия
 */
function AlertDialog({ 
  isOpen, 
  title = 'Уведомление', 
  message,
  buttonText = 'OK',
  onClose 
}) {
  if (!isOpen) return null

  const handleClose = () => {
    onClose?.()
  }

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      handleClose()
    }
  }

  return (
    <div className="modal-overlay" onClick={handleBackdropClick}>
      <div className="modal-dialog alert-dialog">
        <div className="modal-header">
          <h3 className="modal-title">{title}</h3>
        </div>
        <div className="modal-body">
          <p className="modal-message">{message}</p>
        </div>
        <div className="modal-footer">
          <button 
            className="btn btn-primary" 
            onClick={handleClose}
          >
            {buttonText}
          </button>
        </div>
      </div>
    </div>
  )
}

export default AlertDialog

