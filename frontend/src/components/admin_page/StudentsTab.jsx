import CreateStudentForm from './CreateStudentForm'
import UserList from './UserList'

function StudentsTab({ 
  form, 
  setForm, 
  onSubmit, 
  generatePassword, 
  groups,
  students, 
  searchValue, 
  onSearchChange, 
  onDelete,
  onUpdateGroup,
  onSetTemporaryPassword
}) {
  return (
    <div className="tab-content active">
      <div className="tab-section">
        <CreateStudentForm
          form={form}
          setForm={setForm}
          onSubmit={onSubmit}
          generatePassword={generatePassword}
          groups={groups}
        />
        <UserList
          title="Список студентов"
          users={students}
          searchValue={searchValue}
          onSearchChange={onSearchChange}
          searchPlaceholder="Поиск по логину, ФИО, группе..."
          onDelete={onDelete}
          onUpdateGroup={onUpdateGroup}
          onSetTemporaryPassword={onSetTemporaryPassword}
          groups={groups}
          isStudents={true}
        />
      </div>
    </div>
  )
}

export default StudentsTab

