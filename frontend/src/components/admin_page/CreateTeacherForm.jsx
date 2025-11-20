import PasswordField from './PasswordField'

function CreateTeacherForm({ form, setForm, onSubmit, generatePassword }) {
  const handleChange = (field, value) => {
    setForm({ ...form, [field]: value })
  }

  return (
    <div className="create-form-section">
      <h2 className="section-title">Добавить преподавателя</h2>
      <form onSubmit={onSubmit} className="auth-form">
        <label className="form-field">
          <span className="field-label">Логин</span>
          <input
            type="text"
            value={form.login}
            onChange={(e) => handleChange('login', e.target.value)}
            placeholder="Введите логин"
            required
          />
        </label>
        <label className="form-field">
          <span className="field-label">Временный пароль</span>
          <PasswordField
            value={form.password}
            onChange={(value) => handleChange('password', value)}
            onGenerate={() => handleChange('password', generatePassword())}
          />
        </label>
        <label className="form-field">
          <span className="field-label">Фамилия</span>
          <input
            type="text"
            value={form.last_name}
            onChange={(e) => handleChange('last_name', e.target.value)}
            placeholder="Введите фамилию"
            required
          />
        </label>
        <label className="form-field">
          <span className="field-label">Имя</span>
          <input
            type="text"
            value={form.first_name}
            onChange={(e) => handleChange('first_name', e.target.value)}
            placeholder="Введите имя"
            required
          />
        </label>
        <label className="form-field">
          <span className="field-label">Отчество</span>
          <input
            type="text"
            value={form.middle_name}
            onChange={(e) => handleChange('middle_name', e.target.value)}
            placeholder="Необязательно"
          />
        </label>
        <button type="submit" className="btn-primary">Создать преподавателя</button>
      </form>
    </div>
  )
}

export default CreateTeacherForm

