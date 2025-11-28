import { useNavigate } from 'react-router-dom'
import { useAuth } from './useAuth'
import { navigateToHome, navigateToCourses } from '../utils/navigation'

/**
 * Хук для навигации в зависимости от роли пользователя
 * Предоставляет готовые функции для навигации
 */
export function useNavigation() {
  const navigate = useNavigate()
  const { role } = useAuth()

  const goHome = () => {
    navigateToHome(navigate, role)
  }

  const goToCourses = () => {
    navigateToCourses(navigate, role)
  }

  return {
    goHome,
    goToCourses
  }
}

