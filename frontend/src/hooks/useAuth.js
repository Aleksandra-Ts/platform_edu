import { useState, useEffect } from 'react'

export function useAuth() {
  const [token, setToken] = useState(localStorage.getItem('token'))
  const [role, setRole] = useState(localStorage.getItem('role'))
  const [userId, setUserId] = useState(localStorage.getItem('userId'))

  useEffect(() => {
    const handleStorageChange = () => {
      setToken(localStorage.getItem('token'))
      setRole(localStorage.getItem('role'))
      setUserId(localStorage.getItem('userId'))
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  const login = (newToken, newRole, newUserId) => {
    localStorage.setItem('token', newToken)
    localStorage.setItem('role', newRole)
    localStorage.setItem('userId', newUserId)
    setToken(newToken)
    setRole(newRole)
    setUserId(newUserId)
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('role')
    localStorage.removeItem('userId')
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
    isAdmin
  }
}

