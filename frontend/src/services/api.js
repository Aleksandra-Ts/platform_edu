// В режиме разработки используем прокси из vite.config.js
// В продакшене API будет на том же домене
const API_BASE = import.meta.env.DEV ? '/api' : ''

class ApiClient {
  constructor() {
    this.baseURL = API_BASE
  }

  async request(endpoint, options = {}) {
    const token = localStorage.getItem('token')
    const url = `${this.baseURL}${endpoint}`
    
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    const config = {
      ...options,
      headers
    }

    try {
      const response = await fetch(url, config)
      
      // Проверяем 401 до парсинга JSON
      if (response.status === 401) {
        localStorage.removeItem('token')
        localStorage.removeItem('role')
        localStorage.removeItem('userId')
        // Редирект на логин только если мы не на странице логина
        if (!window.location.pathname.includes('/login')) {
          window.location.href = '/login'
        }
        const errorData = await response.json().catch(() => ({ detail: 'Unauthorized' }))
        throw new Error(errorData.detail || 'Требуется повторный вход')
      }
      
      const data = await response.json().catch(() => ({}))
      
      if (!response.ok) {
        throw new Error(data.detail || `HTTP error! status: ${response.status}`)
      }
      
      return data
    } catch (error) {
      // Если это уже обработанная 401 ошибка, просто пробрасываем её
      if (error.message.includes('Требуется повторный вход') || error.message.includes('Unauthorized')) {
        throw error
      }
      throw error
    }
  }

  // Auth
  async login(login, password) {
    const formData = new FormData()
    formData.append('login', login)
    formData.append('password', password)
    
    const response = await fetch(`${this.baseURL}/login`, {
      method: 'POST',
      body: formData
    })
    
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.detail || 'Ошибка входа')
    }
    
    return data
  }

  async changePassword(userId, newPassword, confirmPassword) {
    return this.request(`/change_password/${userId}`, {
      method: 'POST',
      body: JSON.stringify({ new_password: newPassword, confirm_password: confirmPassword })
    })
  }

  // User
  async getProfile() {
    return this.request('/me')
  }

  async getMyCourses() {
    return this.request('/me/courses')
  }

  async updateProfile(lastName, firstName, middleName) {
    return this.request('/me', {
      method: 'PUT',
      body: JSON.stringify({
        last_name: lastName,
        first_name: firstName,
        middle_name: middleName || null
      })
    })
  }

  async changeOwnPassword(currentPassword, newPassword, confirmPassword) {
    return this.request('/me/change_password', {
      method: 'POST',
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword
      })
    })
  }

  // Admin
  async getUsers() {
    return this.request('/admin/users')
  }

  async createUser(userData) {
    return this.request('/admin/create_user', {
      method: 'POST',
      body: JSON.stringify(userData)
    })
  }

  async updateUserGroup(userId, groupId) {
    return this.request(`/admin/users/${userId}/group`, {
      method: 'PUT',
      body: JSON.stringify({ group_id: groupId || null })
    })
  }

  async setTemporaryPassword(userId, password = null) {
    return this.request(`/admin/users/${userId}/set_temporary_password`, {
      method: 'POST',
      body: JSON.stringify({ password })
    })
  }

  async deleteUser(userId) {
    return this.request(`/admin/delete_user/${userId}`, {
      method: 'DELETE'
    })
  }

  async getGroups() {
    return this.request('/admin/groups')
  }

  async createGroup(name) {
    return this.request('/admin/groups', {
      method: 'POST',
      body: JSON.stringify({ name })
    })
  }

  async deleteGroup(groupId) {
    return this.request(`/admin/groups/${groupId}`, {
      method: 'DELETE'
    })
  }

  async getGroupUsers(groupId) {
    return this.request(`/admin/groups/${groupId}/users`)
  }

  async getCourses() {
    return this.request('/admin/courses')
  }

  async getCourse(courseId) {
    // Для преподавателей используем /me/courses, для админов - /admin/courses
    const role = localStorage.getItem('role')
    if (role === 'teacher') {
      return this.request(`/me/courses/${courseId}`)
    }
    return this.request(`/admin/courses/${courseId}`)
  }

  // Lectures
  async getLectures(courseId) {
    return this.request(`/courses/${courseId}/lectures`)
  }

  async createLecture(lectureData) {
    return this.request('/lectures', {
      method: 'POST',
      body: JSON.stringify(lectureData)
    })
  }

  async getLecture(lectureId) {
    return this.request(`/lectures/${lectureId}`)
  }

  async updateLecture(lectureId, lectureData) {
    return this.request(`/lectures/${lectureId}`, {
      method: 'PUT',
      body: JSON.stringify(lectureData)
    })
  }

  async deleteLecture(lectureId) {
    return this.request(`/lectures/${lectureId}`, {
      method: 'DELETE'
    })
  }

  async uploadMaterial(lectureId, file) {
    const token = localStorage.getItem('token')
    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch(`${this.baseURL}/lectures/${lectureId}/materials`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    })

    if (response.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('role')
      localStorage.removeItem('userId')
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login'
      }
      throw new Error('Unauthorized: Session expired or invalid token.')
    }

    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.detail || `HTTP error! status: ${response.status}`)
    }
    return data
  }

  async deleteMaterial(lectureId, materialId) {
    return this.request(`/lectures/${lectureId}/materials/${materialId}`, {
      method: 'DELETE'
    })
  }

  async reorderMaterials(lectureId, materialIds) {
    return this.request(`/lectures/${lectureId}/materials/reorder`, {
      method: 'PUT',
      body: JSON.stringify(materialIds)
    })
  }

  async getMaterialContent(materialId) {
    return this.request(`/materials/${materialId}/content`)
  }

  async createCourse(courseData) {
    return this.request('/admin/courses', {
      method: 'POST',
      body: JSON.stringify(courseData)
    })
  }

  async updateCourse(courseId, courseData) {
    return this.request(`/admin/courses/${courseId}`, {
      method: 'PUT',
      body: JSON.stringify(courseData)
    })
  }

  async deleteCourse(courseId) {
    return this.request(`/admin/courses/${courseId}`, {
      method: 'DELETE'
    })
  }

  async exportUsers(role, groupId) {
    const token = localStorage.getItem('token')
    const params = new URLSearchParams()
    if (role) params.append('role', role)
    if (groupId) params.append('group_id', groupId)
    
    const url = `${this.baseURL}/admin/export_users?${params.toString()}`
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    })

    // Проверяем 401 до парсинга JSON
    if (response.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('role')
      localStorage.removeItem('userId')
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login'
      }
      const errorData = await response.json().catch(() => ({ detail: 'Unauthorized' }))
      throw new Error(errorData.detail || 'Требуется повторный вход')
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.detail || 'Ошибка при выгрузке')
    }

    const blob = await response.blob()
    const downloadUrl = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = downloadUrl
    const contentDisposition = response.headers.get('Content-Disposition')
    const filename = contentDisposition?.split('filename=')[1]?.replace(/"/g, '') || 'users_export.xlsx'
    a.download = decodeURIComponent(filename)
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(downloadUrl)
  }
}

export default new ApiClient()

