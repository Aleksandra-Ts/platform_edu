import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import { useAuth } from '../hooks/useAuth'
import { getCurrentRole } from '../utils/navigation'
import '../styles/auth.css'
import ProfileHeader from '../components/profile_page/ProfileHeader'
import ProfileSummary from '../components/profile_page/ProfileSummary'
import ProfileEditForm from '../components/profile_page/ProfileEditForm'
import PasswordChangeForm from '../components/profile_page/PasswordChangeForm'
import ProfileMessages from '../components/profile_page/ProfileMessages'

function Profile() {
  const [profile, setProfile] = useState(null)
  const [lastName, setLastName] = useState('')
  const [firstName, setFirstName] = useState('')
  const [middleName, setMiddleName] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const { logout, role } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    try {
      const data = await api.getProfile()
      setProfile(data)
      setLastName(data.last_name || '')
      setFirstName(data.first_name || '')
      setMiddleName(data.middle_name || '')
    } catch (err) {
      setMessage(err.message)
    }
  }

  const handleProfileUpdate = async (e) => {
    e.preventDefault()
    setMessage('')
    setSuccessMessage('')

    if (!lastName.trim() || !firstName.trim()) {
      setMessage('Имя и фамилия обязательны')
      return
    }

    try {
      const data = await api.updateProfile(
        lastName.trim(),
        firstName.trim(),
        middleName.trim() || null
      )
      setProfile(data)
      setSuccessMessage('Данные профиля обновлены')
    } catch (err) {
      setMessage(err.message)
    }
  }

  const handlePasswordChange = async (e) => {
    e.preventDefault()
    setMessage('')
    setSuccessMessage('')

    if (newPassword !== confirmPassword) {
      setMessage('Пароли не совпадают')
      return
    }

    try {
      await api.changeOwnPassword(currentPassword, newPassword, confirmPassword)
      setSuccessMessage('Пароль обновлён')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setMessage(err.message)
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  if (!profile) {
    return <div>Загрузка...</div>
  }

  return (
    <main className="profile-single">
      <section className="profile-shell">
        <div className="profile-header-with-logout">
          <ProfileHeader />
          <div className="profile-actions">
            {(role === 'admin' || getCurrentRole(role) === 'admin') && (
              <button
                className="btn-outline"
                onClick={() => navigate('/admin')}
                title="Админ-панель"
              >
                Админ-панель
              </button>
            )}
            <button
              className="logout-button"
              onClick={handleLogout}
              title="Выйти"
            >
              Выйти
            </button>
          </div>
        </div>
        <ProfileSummary profile={profile} />
        <ProfileEditForm
          lastName={lastName}
          setLastName={setLastName}
          firstName={firstName}
          setFirstName={setFirstName}
          middleName={middleName}
          setMiddleName={setMiddleName}
          onSubmit={handleProfileUpdate}
        />
        <PasswordChangeForm
          currentPassword={currentPassword}
          setCurrentPassword={setCurrentPassword}
          newPassword={newPassword}
          setNewPassword={setNewPassword}
          confirmPassword={confirmPassword}
          setConfirmPassword={setConfirmPassword}
          onSubmit={handlePasswordChange}
        />
        <ProfileMessages message={message} successMessage={successMessage} />
      </section>
    </main>
  )
}

export default Profile
