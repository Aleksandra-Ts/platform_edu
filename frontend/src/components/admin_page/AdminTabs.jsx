function AdminTabs({ activeTab, onTabChange }) {
  const tabs = [
    { id: 'teachersTab', label: 'Преподаватели' },
    { id: 'studentsTab', label: 'Студенты' },
    { id: 'groupsTab', label: 'Группы' },
    { id: 'coursesTab', label: 'Курсы' },
    { id: 'exportTab', label: 'Выгрузка' }
  ]

  return (
    <div className="tabs-container">
      {tabs.map(tab => (
        <button
          key={tab.id}
          className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => onTabChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

export default AdminTabs

