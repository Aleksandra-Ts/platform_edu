import PasswordField from './PasswordField'

/**
 * Универсальная форма для создания пользователя (преподавателя или студента)
 * @param {Object} props
 * @param {Object} props.form - Объект формы с полями пользователя
 * @param {Function} props.setForm - Функция для обновления формы
 * @param {Function} props.onSubmit - Обработчик отправки формы
 * @param {Function} props.generatePassword - Функция генерации пароля
 * @param {string} props.userType - Тип пользователя: 'teacher' | 'student'
 * @param {Array} props.groups - Массив групп (только для студентов)
 */
function CreateUserForm({ form, setForm, onSubmit, generatePassword, userType, groups = [] }) {
  const handleChange = (field, value) => {
    setForm({ ...form, [field]: value })
  }

  const isStudent = userType === 'student'
  const title = isStudent ? 'Добавить студента' : 'Добавить преподавателя'
  const buttonText = isStudent ? 'Создать студента' : 'Создать преподавателя'

  return (
    <div className="create-form-section">
      <h2 className="section-title">{title}</h2>
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
        {isStudent && (
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
        )}
        <button type="submit" className="btn-primary">{buttonText}</button>
      </form>
    </div>
  )
}

export default CreateUserForm

