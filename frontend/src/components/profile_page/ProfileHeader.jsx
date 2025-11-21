import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

function ProfileHeader() {
  const navigate = useNavigate()
  const { role } = useAuth()
  
  const handleHomeClick = () => {
    const currentRole = role || localStorage.getItem('role')
    if (currentRole === 'teacher') {
      navigate('/dashboard')
    } else if (currentRole === 'student') {
      navigate('/student-dashboard')
    } else if (currentRole === 'admin') {
      navigate('/admin')
    } else {
      navigate('/')
    }
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

