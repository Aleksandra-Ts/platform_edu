/**
 * Утилиты для навигации в зависимости от роли пользователя
 */
import storage from '../services/storage'

/**
 * Получает текущую роль пользователя (из state или storage)
 * @param {string|null} role - Роль из useAuth hook (может быть null при первой загрузке)
 * @returns {string|null} - Текущая роль пользователя
 */
export function getCurrentRole(role = null) {
  return role || storage.getRole()
}

/**
 * Навигация в зависимости от роли пользователя
 * @param {Function} navigate - Функция навигации из react-router-dom
 * @param {string|null} role - Роль из useAuth hook
 * @param {Object} options - Опции для навигации
 * @param {string} options.teacherPath - Путь для преподавателя (по умолчанию '/dashboard')
 * @param {string} options.studentPath - Путь для студента (по умолчанию '/student-dashboard')
 * @param {string} options.adminPath - Путь для админа (по умолчанию '/admin')
 * @param {string} options.defaultPath - Путь по умолчанию (по умолчанию '/profile')
 */
export function navigateByRole(navigate, role = null, options = {}) {
  const {
    teacherPath = '/dashboard',
    studentPath = '/student-dashboard',
    adminPath = '/admin',
    defaultPath = '/profile'
  } = options

  const currentRole = getCurrentRole(role)

  if (currentRole === 'teacher') {
    navigate(teacherPath)
  } else if (currentRole === 'student') {
    navigate(studentPath)
  } else if (currentRole === 'admin') {
    navigate(adminPath)
  } else {
    navigate(defaultPath)
  }
}

/**
 * Навигация на главную страницу (dashboard) в зависимости от роли
 * @param {Function} navigate - Функция навигации из react-router-dom
 * @param {string|null} role - Роль из useAuth hook
 */
export function navigateToHome(navigate, role = null) {
  navigateByRole(navigate, role)
}

/**
 * Навигация на страницу курсов в зависимости от роли
 * @param {Function} navigate - Функция навигации из react-router-dom
 * @param {string|null} role - Роль из useAuth hook
 */
export function navigateToCourses(navigate, role = null) {
  navigateByRole(navigate, role, {
    teacherPath: '/dashboard?view=courses',
    studentPath: '/student-dashboard'
  })
}


