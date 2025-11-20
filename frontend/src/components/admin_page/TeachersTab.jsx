import CreateTeacherForm from './CreateTeacherForm'
import UserList from './UserList'

function TeachersTab({ 
  form, 
  setForm, 
  onSubmit, 
  generatePassword, 
  teachers, 
  searchValue, 
  onSearchChange, 
  onDelete,
  onSetTemporaryPassword
}) {
  return (
    <div className="tab-content active">
      <div className="tab-section">
        <CreateTeacherForm
          form={form}
          setForm={setForm}
          onSubmit={onSubmit}
          generatePassword={generatePassword}
        />
        <UserList
          title="Список преподавателей"
          users={teachers}
          searchValue={searchValue}
          onSearchChange={onSearchChange}
          searchPlaceholder="Поиск по логину, ФИО..."
          onDelete={onDelete}
          onSetTemporaryPassword={onSetTemporaryPassword}
        />
      </div>
    </div>
  )
}

export default TeachersTab

