import { useState, useEffect } from 'react'
import storage from '../services/storage'

export function useAuth() {
  const [token, setToken] = useState(storage.getToken())
  const [role, setRole] = useState(storage.getRole())
  const [userId, setUserId] = useState(storage.getUserId())

  useEffect(() => {
    const handleStorageChange = () => {
      setToken(storage.getToken())
      setRole(storage.getRole())
      setUserId(storage.getUserId())
    }

    // Слушаем изменения в других вкладках
    window.addEventListener('storage', handleStorageChange)
    
    return () => {
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [])

  const login = (newToken, newRole, newUserId) => {
    storage.setAuthData(newToken, newRole, newUserId)
    setToken(newToken)
    setRole(newRole)
    setUserId(newUserId)
  }

  const logout = () => {
    storage.clearAuth()
    setToken(null)
    setRole(null)
    setUserId(null)
  }

  const isAuthenticated = () => !!token
  const isAdmin = () => role === 'admin'

  return {
    token,
    role,
    userId,
    login,
    logout,
    isAuthenticated,
    isAdmin,
    // Дополнительные методы используют state, а не storage напрямую
    // для избежания рассинхронизации
    getToken: () => token,
    getRole: () => role,
    getUserId: () => userId
  }
}

