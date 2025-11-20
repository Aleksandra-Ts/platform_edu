import SearchField from './SearchField'

function GroupList({ groups, searchValue, onSearchChange, onDelete }) {
  return (
    <div className="list-section">
      <h2 className="section-title">Список групп</h2>
      <SearchField
        value={searchValue}
        onChange={onSearchChange}
        placeholder="Поиск по названию..."
      />
      <div className="items-list">
        {groups.length === 0 ? (
          <div className="empty-state">Группы не найдены</div>
        ) : (
          groups.map(group => (
            <div key={group.id} className="item-card">
              <div className="item-info">
                <div className="item-title">{group.name}</div>
              </div>
              <div className="item-actions">
                <button 
                  className="btn-delete" 
                  onClick={() => onDelete(group.id)} 
                  title="Удалить"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default GroupList

