function PasswordChangeForm({
  currentPassword,
  setCurrentPassword,
  newPassword,
  setNewPassword,
  confirmPassword,
  setConfirmPassword,
  onSubmit
}) {
  return (
    <section className="profile-section">
      <h2 className="section-title">Смена пароля</h2>
      <form onSubmit={onSubmit} className="auth-form">
        <label className="form-field">
          <span className="field-label">Текущий пароль</span>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Введите текущий пароль"
            required
          />
        </label>
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
        <button type="submit" className="btn-primary">Обновить пароль</button>
      </form>
    </section>
  )
}

export default PasswordChangeForm

