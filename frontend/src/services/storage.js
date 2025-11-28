/**
 * Централизованный сервис для работы с localStorage
 * Все обращения к localStorage должны идти через этот сервис
 */

class StorageService {
  // Ключи для хранения данных
  KEYS = {
    TOKEN: 'token',
    ROLE: 'role',
    USER_ID: 'userId'
  }

  // Получение токена
  getToken() {
    return localStorage.getItem(this.KEYS.TOKEN)
  }

  // Получение роли
  getRole() {
    return localStorage.getItem(this.KEYS.ROLE)
  }

  // Получение ID пользователя
  getUserId() {
    return localStorage.getItem(this.KEYS.USER_ID)
  }

  // Установка токена
  setToken(token) {
    if (token) {
      localStorage.setItem(this.KEYS.TOKEN, token)
    } else {
      localStorage.removeItem(this.KEYS.TOKEN)
    }
  }

  // Установка роли
  setRole(role) {
    if (role) {
      localStorage.setItem(this.KEYS.ROLE, role)
    } else {
      localStorage.removeItem(this.KEYS.ROLE)
    }
  }

  // Установка ID пользователя
  setUserId(userId) {
    if (userId) {
      localStorage.setItem(this.KEYS.USER_ID, userId)
    } else {
      localStorage.removeItem(this.KEYS.USER_ID)
    }
  }

  // Установка всех данных аутентификации
  setAuthData(token, role, userId) {
    this.setToken(token)
    this.setRole(role)
    this.setUserId(userId)
  }

  // Очистка всех данных аутентификации
  clearAuth() {
    localStorage.removeItem(this.KEYS.TOKEN)
    localStorage.removeItem(this.KEYS.ROLE)
    localStorage.removeItem(this.KEYS.USER_ID)
  }

  // Проверка наличия токена
  hasToken() {
    return !!this.getToken()
  }

  // Получение всех данных аутентификации
  getAuthData() {
    return {
      token: this.getToken(),
      role: this.getRole(),
      userId: this.getUserId()
    }
  }
}

export default new StorageService()

