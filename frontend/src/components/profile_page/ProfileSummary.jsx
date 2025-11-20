function ProfileSummary({ profile }) {
  return (
    <div className="profile-summary glass-card">
      <div className="summary-row">
        <span className="summary-label">ФИО</span>
        <span className="summary-value">{profile.full_name || '-'}</span>
      </div>
      <div className="summary-row">
        <span className="summary-label">Логин</span>
        <span className="summary-value">{profile.login}</span>
      </div>
      {profile.role === 'student' && profile.group_name && (
        <div className="summary-row">
          <span className="summary-label">Группа</span>
          <span className="summary-value">{profile.group_name}</span>
        </div>
      )}
    </div>
  )
}

export default ProfileSummary

