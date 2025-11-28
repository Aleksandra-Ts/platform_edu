import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'
import { useAuth } from '../../hooks/useAuth'

function LoginForm() {
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)
  const navigate = useNavigate()
  const { login: authLogin } = useAuth()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setMessage('')
    setIsError(false)

    try {
      // Используем api.login() вместо прямого fetch
      const data = await api.login(login, password)

      if (data.need_change) {
        navigate(`/change_password?user_id=${data.user_id}`)
        return
      }

      if (data.access_token) {
        // Используем authLogin из useAuth, который уже работает с storage
        authLogin(data.access_token, data.role, data.user_id)
        // Редирект на dashboard в зависимости от роли
        if (data.role === 'teacher') {
          navigate('/dashboard')
        } else if (data.role === 'student') {
          navigate('/student-dashboard')
        } else if (data.role === 'admin') {
          navigate('/admin')
        } else {
          navigate('/profile')
        }
        return
      }

      throw new Error('Не удалось авторизоваться')
    } catch (err) {
      setMessage(err.message)
      setIsError(true)
    }
  }

  return (
    <form id="loginForm" className="auth-form" onSubmit={handleSubmit}>
      <label className="form-field">
        <span className="field-label">Логин</span>
        <input
          type="text"
          name="login"
          value={login}
          onChange={(e) => setLogin(e.target.value)}
          placeholder="Введите логин"
          required
        />
      </label>

      <label className="form-field">
        <span className="field-label">Пароль</span>
        <input
          type="password"
          name="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Введите пароль"
          required
        />
      </label>

      <button type="submit" className="btn-primary">Войти</button>
      <p id="message" className={`form-message ${isError ? 'error' : ''}`} role="alert">
        {message}
      </p>
    </form>
  )
}

export default LoginForm

