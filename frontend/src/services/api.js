class ApiClient {
  constructor() {
    this.baseURL = '/api'
  }

  async request(endpoint, options = {}) {
    const token = localStorage.getItem('token')
    const url = `${this.baseURL}${endpoint}`
    
    const config = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...(options.headers || {})
      }
    }

    try {
      const response = await fetch(url, config)
      
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
    } catch (error) {
      if (error.message.includes('Unauthorized')) {
        throw error
      }
      throw new Error(error.message || 'Network error')
    }
  }

  // Auth methods
  async login(login, password) {
    const formData = new FormData()
    formData.append('username', login)
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

  // User methods
  async getProfile() {
    return this.request('/me')
  }

  async updateProfile(firstName, lastName, middleName) {
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

  async changePassword(userId, newPassword, confirmPassword) {
    return this.request(`/change_password/${userId}`, {
      method: 'POST',
      body: JSON.stringify({ new_password: newPassword, confirm_password: confirmPassword })
    })
  }

  // Admin methods
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
    // Для преподавателей и студентов используем /me/courses, для админов - /admin/courses
    const role = localStorage.getItem('role')
    if (role === 'teacher' || role === 'student') {
      const courses = await this.request('/me/courses')
      return courses.find(c => c.id === parseInt(courseId))
    } else {
      return this.request(`/admin/courses/${courseId}`)
    }
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

  async exportUsers(role = null, groupId = null) {
    const token = localStorage.getItem('token')
    const params = new URLSearchParams()
    if (role) params.append('role', role)
    if (groupId) params.append('group_id', groupId.toString())
    
    const url = `${this.baseURL}/admin/export_users?${params.toString()}`
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
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

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || `HTTP error! status: ${response.status}`)
    }

    const blob = await response.blob()
    const contentDisposition = response.headers.get('Content-Disposition')
    const filename = contentDisposition?.split('filename=')[1]?.replace(/"/g, '') || 'users_export.xlsx'
    
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = decodeURIComponent(filename)
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(a.href)
  }

  // Course methods
  async getMyCourses() {
    return this.request('/me/courses')
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

  async publishLecture(lectureId) {
    return this.request(`/lectures/${lectureId}/publish`, {
      method: 'POST'
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
    const token = localStorage.getItem('token')
    const response = await fetch(`${this.baseURL}/materials/${materialId}/content`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
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

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || `HTTP error! status: ${response.status}`)
    }

    return response.json()
  }

  async transcribeVideo(materialId) {
    const token = localStorage.getItem('token')
    const response = await fetch(`${this.baseURL}/materials/${materialId}/transcribe`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
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

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || `HTTP error! status: ${response.status}`)
    }

    return response.json()
  }

  // Test methods
  async getLectureTest(lectureId) {
    return this.request(`/tests/lectures/${lectureId}/test`)
  }

  async checkTestAnswers(lectureId, answers) {
    return this.request(`/tests/lectures/${lectureId}/test/check`, {
      method: 'POST',
      body: JSON.stringify(answers)
    })
  }

  async getTestAttempts(lectureId) {
    return this.request(`/tests/lectures/${lectureId}/test/attempts`)
  }

  async getAllTestAttempts(lectureId) {
    return this.request(`/tests/lectures/${lectureId}/test/all-attempts`)
  }
}

export default new ApiClient()

