function ProfileEditForm({ 
  lastName, 
  setLastName, 
  firstName, 
  setFirstName, 
  middleName, 
  setMiddleName, 
  onSubmit 
}) {
  return (
    <section className="profile-section">
      <h2 className="section-title">Редактирование профиля</h2>
      <form onSubmit={onSubmit} className="auth-form">
        <label className="form-field">
          <span className="field-label">Фамилия</span>
          <input
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Введите фамилию"
            required
          />
        </label>
        <label className="form-field">
          <span className="field-label">Имя</span>
          <input
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="Введите имя"
            required
          />
        </label>
        <label className="form-field">
          <span className="field-label">Отчество</span>
          <input
            type="text"
            value={middleName}
            onChange={(e) => setMiddleName(e.target.value)}
            placeholder="Необязательно"
          />
        </label>
        <button type="submit" className="btn-primary">Сохранить изменения</button>
      </form>
    </section>
  )
}

export default ProfileEditForm

