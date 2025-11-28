import CreateUserForm from './CreateUserForm'
import UserList from './UserList'

/**
 * Универсальный компонент для отображения вкладки пользователей (преподавателей или студентов)
 * @param {string} userType - Тип пользователя: 'teacher' | 'student'
 * @param {Object} form - Объект формы
 * @param {Function} setForm - Функция для обновления формы
 * @param {Function} onSubmit - Обработчик отправки формы
 * @param {Function} generatePassword - Функция генерации пароля
 * @param {Array} users - Массив пользователей для отображения
 * @param {string} searchValue - Значение поиска
 * @param {Function} onSearchChange - Обработчик изменения поиска
 * @param {Function} onDelete - Обработчик удаления пользователя
 * @param {Function} onSetTemporaryPassword - Обработчик установки временного пароля
 * @param {Array} groups - Массив групп (только для студентов)
 * @param {Function} onUpdateGroup - Обработчик обновления группы (только для студентов)
 */
function UsersTab({ 
  userType,
  form, 
  setForm, 
  onSubmit, 
  generatePassword, 
  users, 
  searchValue, 
  onSearchChange, 
  onDelete,
  onSetTemporaryPassword,
  groups = [],
  onUpdateGroup = null
}) {
  const isStudent = userType === 'student'
  const title = isStudent ? 'Список студентов' : 'Список преподавателей'
  const searchPlaceholder = isStudent 
    ? 'Поиск по логину, ФИО, группе...' 
    : 'Поиск по логину, ФИО...'

  return (
    <div className="tab-content active">
      <div className="tab-section">
        <CreateUserForm
          form={form}
          setForm={setForm}
          onSubmit={onSubmit}
          generatePassword={generatePassword}
          userType={userType}
          groups={isStudent ? groups : undefined}
        />
        <UserList
          title={title}
          users={users}
          searchValue={searchValue}
          onSearchChange={onSearchChange}
          searchPlaceholder={searchPlaceholder}
          onDelete={onDelete}
          onSetTemporaryPassword={onSetTemporaryPassword}
          groups={isStudent ? groups : undefined}
          isStudents={isStudent}
          onUpdateGroup={isStudent ? onUpdateGroup : undefined}
        />
      </div>
    </div>
  )
}

export default UsersTab

