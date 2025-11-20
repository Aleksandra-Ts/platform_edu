import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../services/api'
import '../styles/auth.css'

function ChangePassword() {
  const [searchParams] = useSearchParams()
  const userId = parseInt(searchParams.get('user_id'))
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setMessage('')
    setIsError(false)

    if (newPassword !== confirmPassword) {
      setMessage('Пароли не совпадают')
      setIsError(true)
      return
    }

    try {
      await api.changePassword(userId, newPassword, confirmPassword)
      setMessage('Пароль успешно изменен')
      setIsError(false)
      setTimeout(() => {
        navigate('/login')
      }, 2000)
    } catch (err) {
      setMessage(err.message)
      setIsError(true)
    }
  }

  return (
    <main className="auth-layout">
      <section className="auth-card">
        <header className="auth-header">
          <h1 className="auth-title">Смена пароля</h1>
          <p className="auth-subtitle">Введите новый пароль для вашей учётной записи.</p>
        </header>

        <form onSubmit={handleSubmit} className="auth-form">
          <label className="form-field">
            <span className="field-label">Новый пароль</span>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Введите новый пароль"
              required
            />
          </label>

          <label className="form-field">
            <span className="field-label">Подтвердите пароль</span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Повторите пароль"
              required
            />
          </label>

          <p className="form-hint">Минимум 8 символов: латинские буквы, цифры, спецсимволы, без пробелов.</p>

          <button type="submit" className="btn-primary">Изменить пароль</button>
          <p className={`form-message ${isError ? 'error' : 'success'}`} role="alert">
            {message}
          </p>
        </form>
      </section>

      <aside className="auth-aside">
        <div className="aside-content">
          <h2>Умный конспект</h2>
          <p>Безопасность ваших данных - наш приоритет. Выберите надежный пароль для защиты вашего аккаунта.</p>
        </div>
      </aside>
    </main>
  )
}

export default ChangePassword

