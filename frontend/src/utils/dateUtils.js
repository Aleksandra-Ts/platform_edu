/**
 * Утилиты для работы с датами
 */

/**
 * Парсит строку дедлайна в объект Date
 * Поддерживает различные форматы:
 * - YYYY-MM-DDTHH:mm (локальное время, без таймзоны)
 * - ISO формат (с Z или +)
 * - Уже объект Date
 * @param {string|Date} deadlineString - Строка дедлайна или объект Date
 * @returns {Date|null} - Объект Date или null, если не удалось распарсить
 */
export function parseDeadline(deadlineString) {
  if (!deadlineString) return null
  
  // Если это уже объект Date, возвращаем его
  if (deadlineString instanceof Date) return deadlineString
  
  // Если это не строка, пытаемся преобразовать
  if (typeof deadlineString !== 'string') {
    try {
      return new Date(deadlineString)
    } catch (e) {
      return null
    }
  }
  
  // Если формат YYYY-MM-DDTHH:mm (локальное время, без таймзоны)
  if (deadlineString.includes('T') && !deadlineString.includes('Z') && !deadlineString.includes('+')) {
    const [datePart, timePart] = deadlineString.split('T')
    return new Date(`${datePart}T${timePart}`)
  }
  
  // Иначе парсим как ISO или другой формат
  try {
    return new Date(deadlineString)
  } catch (e) {
    return null
  }
}

