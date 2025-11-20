import { useState, useRef, useEffect } from 'react'

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
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        // Небольшая задержка, чтобы onChange успел сработать
        setTimeout(() => {
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
    }
  }, [isOpen])

  return (
    <div ref={dropdownRef} style={{ position: 'relative', width: '100%' }}>
      <div
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setIsOpen(!isOpen)
        }}
        className="multi-select-trigger"
        style={{
          padding: '0.875rem 1rem',
          border: '1px solid rgba(17, 91, 73, 0.18)',
          borderRadius: '18px',
          cursor: 'pointer',
          background: 'rgba(255, 255, 255, 0.9)',
          minHeight: '48px',
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '6px',
          transition: 'all 0.2s ease',
          position: 'relative'
        }}
        onMouseEnter={(e) => {
          if (!isOpen) {
            e.currentTarget.style.borderColor = 'rgba(17, 91, 73, 0.3)'
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.95)'
          }
        }}
        onMouseLeave={(e) => {
          if (!isOpen) {
            e.currentTarget.style.borderColor = 'rgba(17, 91, 73, 0.18)'
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.9)'
          }
        }}
      >
        {selectedOptions.length === 0 ? (
          <span style={{ color: 'rgba(11, 47, 36, 0.5)', fontSize: '1rem' }}>{placeholder}</span>
        ) : (
          <>
            {selectedOptions.map(opt => (
              <span
                key={opt.id}
                className="multi-select-tag"
                style={{
                  background: 'linear-gradient(135deg, #0b3d2c, #0f6b51)',
                  color: 'white',
                  padding: '6px 12px',
                  borderRadius: '12px',
                  fontSize: '0.9rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontWeight: '500',
                  boxShadow: '0 2px 4px rgba(15, 60, 47, 0.2)',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.05)'
                  e.currentTarget.style.boxShadow = '0 4px 8px rgba(15, 60, 47, 0.3)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)'
                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(15, 60, 47, 0.2)'
                }}
              >
                {opt.name}
                <button
                  onClick={(e) => handleRemove(opt.id, e)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.3)',
                    border: 'none',
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: '16px',
                    padding: '0',
                    lineHeight: '1',
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s ease',
                    fontWeight: 'bold'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.5)'
                    e.currentTarget.style.transform = 'rotate(90deg)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)'
                    e.currentTarget.style.transform = 'rotate(0deg)'
                  }}
                >
                  ×
                </button>
              </span>
            ))}
            {selectedOptions.length > 0 && (
              <span style={{ 
                color: 'rgba(11, 47, 36, 0.6)', 
                fontSize: '0.85rem',
                marginLeft: 'auto',
                paddingLeft: '8px'
              }}>
                {selectedOptions.length} выбрано
              </span>
            )}
          </>
        )}
        <span
          style={{
            marginLeft: 'auto',
            color: 'rgba(11, 47, 36, 0.5)',
            fontSize: '1.2rem',
            transition: 'transform 0.2s ease',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)'
          }}
        >
          ▼
        </span>
      </div>
      {isOpen && (
        <div
          className="multi-select-dropdown"
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            background: 'white',
            border: '1px solid rgba(17, 91, 73, 0.18)',
            borderRadius: '18px',
            marginTop: '4px',
            maxHeight: '320px',
            overflow: 'hidden',
            zIndex: 1000,
            boxShadow: '0 8px 24px rgba(15, 60, 47, 0.15)',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <div style={{ padding: '12px', borderBottom: '1px solid rgba(17, 91, 73, 0.1)' }}>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              style={{
                width: '100%',
                padding: '10px 14px',
                border: '1px solid rgba(17, 91, 73, 0.18)',
                borderRadius: '12px',
                fontSize: '1rem',
                outline: 'none',
                transition: 'all 0.2s ease',
                boxSizing: 'border-box'
              }}
              onClick={(e) => e.stopPropagation()}
              onFocus={(e) => {
                e.target.style.borderColor = 'rgba(17, 91, 73, 0.45)'
                e.target.style.boxShadow = '0 0 0 3px rgba(0, 230, 173, 0.18)'
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'rgba(17, 91, 73, 0.18)'
                e.target.style.boxShadow = 'none'
              }}
            />
          </div>
          <div style={{ overflowY: 'auto', maxHeight: '260px' }}>
            {filteredOptions.length === 0 ? (
              <div style={{ 
                padding: '24px', 
                color: 'rgba(11, 47, 36, 0.5)', 
                textAlign: 'center',
                fontSize: '0.95rem'
              }}>
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
                    style={{
                      padding: '12px 16px',
                      cursor: 'pointer',
                      background: isSelected ? 'rgba(0, 230, 173, 0.1)' : 'white',
                      borderBottom: '1px solid rgba(17, 91, 73, 0.08)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      transition: 'all 0.2s ease',
                      position: 'relative'
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background = 'rgba(0, 230, 173, 0.05)'
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background = 'white'
                      }
                    }}
                  >
                    <div
                      style={{
                        width: '20px',
                        height: '20px',
                        border: `2px solid ${isSelected ? '#0f6b51' : 'rgba(17, 91, 73, 0.3)'}`,
                        borderRadius: '4px',
                        background: isSelected ? '#0f6b51' : 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s ease',
                        flexShrink: 0
                      }}
                    >
                      {isSelected && (
                        <span style={{ color: 'white', fontSize: '14px', fontWeight: 'bold' }}>✓</span>
                      )}
                    </div>
                    <span style={{ 
                      flex: 1,
                      color: isSelected ? '#0b3d2c' : 'rgba(11, 47, 36, 0.8)',
                      fontWeight: isSelected ? '500' : '400'
                    }}>
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
