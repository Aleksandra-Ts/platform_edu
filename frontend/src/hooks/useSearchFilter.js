import { useState, useMemo } from 'react'

/**
 * Хук для фильтрации массива данных по поисковому запросу
 * @param {Array} data - Массив данных для фильтрации
 * @param {Function|Array} searchFields - Функция, возвращающая массив строк для поиска из элемента, или массив имен полей
 * @param {string} initialSearch - Начальное значение поиска (по умолчанию '')
 * @returns {Object} - { searchValue, setSearchValue, filteredData }
 */
export function useSearchFilter(data = [], searchFields = [], initialSearch = '') {
  const [searchValue, setSearchValue] = useState(initialSearch)

  const filteredData = useMemo(() => {
    if (!searchValue || !data || data.length === 0) {
      return data
    }

    const searchLower = searchValue.toLowerCase()

    return data.filter(item => {
      // Если searchFields - функция, вызываем её для получения полей
      let fieldsToSearch = []
      if (typeof searchFields === 'function') {
        fieldsToSearch = searchFields(item)
      } else if (Array.isArray(searchFields)) {
        // Если searchFields - массив, извлекаем значения полей
        fieldsToSearch = searchFields
          .map(field => {
            // Поддержка вложенных полей через точку (например, 'user.name')
            const value = field.split('.').reduce((obj, key) => obj?.[key], item)
            return value
          })
          .filter(Boolean) // Убираем undefined/null
      }

      // Проверяем, содержит ли хотя бы одно поле поисковый запрос
      return fieldsToSearch.some(field => {
        const fieldValue = typeof field === 'string' ? field : String(field || '')
        return fieldValue.toLowerCase().includes(searchLower)
      })
    })
  }, [data, searchValue, searchFields])

  return {
    searchValue,
    setSearchValue,
    filteredData
  }
}

