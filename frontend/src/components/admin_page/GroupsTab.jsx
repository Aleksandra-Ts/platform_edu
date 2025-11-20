import CreateGroupForm from './CreateGroupForm'
import GroupList from './GroupList'

function GroupsTab({ 
  form, 
  setForm, 
  onSubmit, 
  groups, 
  searchValue, 
  onSearchChange, 
  onDelete 
}) {
  return (
    <div className="tab-content active">
      <div className="tab-section">
        <CreateGroupForm
          form={form}
          setForm={setForm}
          onSubmit={onSubmit}
        />
        <GroupList
          groups={groups}
          searchValue={searchValue}
          onSearchChange={onSearchChange}
          onDelete={onDelete}
        />
      </div>
    </div>
  )
}

export default GroupsTab

