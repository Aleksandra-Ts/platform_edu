import './ConfirmDialog.css'

/**
 * Компонент диалога подтверждения
 * @param {boolean} isOpen - Открыт ли диалог
 * @param {string} title - Заголовок диалога
 * @param {string} message - Сообщение диалога
 * @param {string} confirmText - Текст кнопки подтверждения (по умолчанию "Да")
 * @param {string} cancelText - Текст кнопки отмены (по умолчанию "Отмена")
 * @param {Function} onConfirm - Обработчик подтверждения
 * @param {Function} onCancel - Обработчик отмены
 */
function ConfirmDialog({ 
  isOpen, 
  title = 'Подтверждение', 
  message, 
  confirmText = 'Да',
  cancelText = 'Отмена',
  onConfirm, 
  onCancel 
}) {
  if (!isOpen) return null

  const handleConfirm = () => {
    onConfirm?.()
  }

  const handleCancel = () => {
    onCancel?.()
  }

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      handleCancel()
    }
  }

  return (
    <div className="modal-overlay" onClick={handleBackdropClick}>
      <div className="modal-dialog confirm-dialog">
        <div className="modal-header">
          <h3 className="modal-title">{title}</h3>
        </div>
        <div className="modal-body">
          <p className="modal-message">{message}</p>
        </div>
        <div className="modal-footer">
          <button 
            className="btn btn-secondary" 
            onClick={handleCancel}
          >
            {cancelText}
          </button>
          <button 
            className="btn btn-primary" 
            onClick={handleConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ConfirmDialog

