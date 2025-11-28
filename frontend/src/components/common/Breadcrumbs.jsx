import './Breadcrumbs.css'

/**
 * Компонент breadcrumbs (хлебные крошки) для навигации
 * @param {Array} items - Массив элементов breadcrumb
 * @param {Object} items[].label - Текст элемента
 * @param {Function} items[].onClick - Обработчик клика (опционально, если не указан, элемент считается активным)
 * @param {boolean} items[].active - Явно указать, что элемент активен (опционально)
 */
function Breadcrumbs({ items = [] }) {
  if (!items || items.length === 0) return null

  return (
    <div className="breadcrumbs">
      {items.map((item, index) => {
        const isLast = index === items.length - 1
        const isActive = item.active !== undefined ? item.active : (!item.onClick && isLast)

        return (
          <span key={index}>
            <span
              className={`breadcrumb-item ${isActive ? 'active' : ''}`}
              onClick={!isActive && item.onClick ? item.onClick : undefined}
            >
              {item.label}
            </span>
            {!isLast && <span className="breadcrumb-separator">/</span>}
          </span>
        )
      })}
    </div>
  )
}

export default Breadcrumbs

