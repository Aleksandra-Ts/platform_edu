import PasswordField from './PasswordField'

function CreateStudentForm({ form, setForm, onSubmit, generatePassword, groups }) {
  const handleChange = (field, value) => {
    setForm({ ...form, [field]: value })
  }

  return (
    <div className="create-form-section">
      <h2 className="section-title">Добавить студента</h2>
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
        <label className="form-field">
          <span className="field-label">Группа</span>
          <select
            value={form.group_id}
            onChange={(e) => handleChange('group_id', e.target.value)}
            required
          >
            <option value="">Выберите группу</option>
            {groups.map(g => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn-primary">Создать студента</button>
      </form>
    </div>
  )
}

export default CreateStudentForm

