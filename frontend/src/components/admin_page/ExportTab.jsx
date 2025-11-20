function ExportTab({ form, setForm, onSubmit, groups }) {
  const handleChange = (field, value) => {
    if (field === 'role' && value !== 'student') {
      setForm({ ...form, [field]: value, group_id: '' })
    } else {
      setForm({ ...form, [field]: value })
    }
  }

  return (
    <div className="tab-content active">
      <div className="export-section">
        <div className="create-form-section">
          <h2 className="section-title">Выгрузка пользователей с временными паролями</h2>
          <p className="export-description">Выберите фильтры для выгрузки данных пользователей в Excel файл</p>
          <form onSubmit={onSubmit} className="auth-form">
            <label className="form-field">
              <span className="field-label">Роль</span>
              <select
                className="export-select"
                value={form.role}
                onChange={(e) => handleChange('role', e.target.value)}
              >
                <option value="">Все пользователи</option>
                <option value="teacher">Преподаватели</option>
                <option value="student">Студенты</option>
              </select>
            </label>
            {form.role === 'student' && (
              <label className="form-field">
                <span className="field-label">Группа</span>
                <select
                  className="export-select"
                  value={form.group_id}
                  onChange={(e) => handleChange('group_id', e.target.value)}
                >
                  <option value="">Все группы</option>
                  {groups.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </label>
            )}
            <button type="submit" className="btn-primary export-btn">
              <span>📥</span> Выгрузить в Excel
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default ExportTab

