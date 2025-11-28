import { useState, useRef, useEffect } from 'react'
import './MultiSelect.css'

function MultiSelect({ 
  options, 
  selectedIds, 
  onChange, 
  placeholder = 'Выберите...',
  searchPlaceholder = 'Поиск...'
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const dropdownRef = useRef(null)

  // Сортируем опции по алфавиту по полю name
  const sortedOptions = [...options].sort((a, b) => {
    const nameA = (a.name || '').toLowerCase()
    const nameB = (b.name || '').toLowerCase()
    return nameA.localeCompare(nameB, 'ru')
  })

  const filteredOptions = sortedOptions.filter(opt =>
    opt.name.toLowerCase().includes(search.toLowerCase())
  )

  const selectedOptions = sortedOptions.filter(opt => selectedIds.includes(opt.id))

  const handleToggle = (id, e) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter(selectedId => selectedId !== id))
    } else {
      onChange([...selectedIds, id])
    }
  }

  const handleRemove = (id, e) => {
    e.stopPropagation()
    onChange(selectedIds.filter(selectedId => selectedId !== id))
  }

  // Закрытие при клике вне компонента
  useEffect(() => {
    let timeoutId = null

    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        // Небольшая задержка, чтобы onChange успел сработать
        timeoutId = setTimeout(() => {
          setIsOpen(false)
          setSearch('')
        }, 100)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      // Очищаем timeout при размонтировании
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }, [isOpen])

  return (
    <div ref={dropdownRef} className="multi-select-container">
      <div
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setIsOpen(!isOpen)
        }}
        className={`multi-select-trigger ${isOpen ? 'multi-select-trigger--open' : ''}`}
      >
        {selectedOptions.length === 0 ? (
          <span className="multi-select-placeholder">{placeholder}</span>
        ) : (
          <>
            {selectedOptions.map(opt => (
              <span key={opt.id} className="multi-select-tag">
                {opt.name}
                <button
                  onClick={(e) => handleRemove(opt.id, e)}
                  className="multi-select-tag-remove"
                >
                  ×
                </button>
              </span>
            ))}
            {selectedOptions.length > 0 && (
              <span className="multi-select-count">
                {selectedOptions.length} выбрано
              </span>
            )}
          </>
        )}
        <span className={`multi-select-arrow ${isOpen ? 'multi-select-arrow--open' : ''}`}>
          ▼
        </span>
      </div>
      {isOpen && (
        <div
          className="multi-select-dropdown"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="multi-select-search-container">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="multi-select-search"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <div className="multi-select-options">
            {filteredOptions.length === 0 ? (
              <div className="multi-select-empty">
                {search ? 'Ничего не найдено' : 'Нет доступных вариантов'}
              </div>
            ) : (
              filteredOptions.map(opt => {
                const isSelected = selectedIds.includes(opt.id)
                return (
                  <div
                    key={opt.id}
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      handleToggle(opt.id, e)
                    }}
                    className={`multi-select-option ${isSelected ? 'multi-select-option--selected' : ''}`}
                  >
                    <div className={`multi-select-checkbox ${isSelected ? 'multi-select-checkbox--checked' : ''}`}>
                      {isSelected && (
                        <span className="multi-select-checkbox-icon">✓</span>
                      )}
                    </div>
                    <span className={`multi-select-option-label ${isSelected ? 'multi-select-option-label--selected' : ''}`}>
                      {opt.name}
                    </span>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default MultiSelect
