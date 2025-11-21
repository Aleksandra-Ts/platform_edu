import { useNavigate } from 'react-router-dom'

function AdminHeader() {
  const navigate = useNavigate()

  const handleProfileClick = () => {
    navigate('/profile')
  }

  return (
    <div className="admin-header">
      <header className="auth-header">
        <h1 className="auth-title">Админ-панель</h1>
        <p className="auth-subtitle">Управление пользователями, группами и настройками платформы.</p>
      </header>
      <button 
        className="btn-outline"
        onClick={handleProfileClick}
        title="Перейти в профиль"
      >
        Профиль
      </button>
    </div>
  )
}

export default AdminHeader

