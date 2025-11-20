import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

function ProfileHeader() {
  const navigate = useNavigate()
  const { role } = useAuth()
  
  const handleHomeClick = () => {
    navigate('/dashboard')
  }

  return (
    <div className="profile-head">
      <div className="breadcrumbs">
        <span className="breadcrumb-item" onClick={handleHomeClick}>
          Главная
        </span>
        <span className="breadcrumb-separator">/</span>
        <span className="breadcrumb-item active">Профиль</span>
      </div>
    </div>
  )
}

export default ProfileHeader

