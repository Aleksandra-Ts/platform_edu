import { useState } from 'react'
import SearchField from './SearchField'

function UserList({ 
  title, 
  users, 
  searchValue, 
  onSearchChange, 
  searchPlaceholder, 
  onDelete,
  onUpdateGroup,
  onSetTemporaryPassword,
  groups,
  isStudents = false
}) {
  const [editingGroup, setEditingGroup] = useState(null)
  const [selectedGroupId, setSelectedGroupId] = useState('')

  const handleStartEdit = (user) => {
    setEditingGroup(user.id)
    setSelectedGroupId(user.group_id || '')
  }

  const handleCancelEdit = () => {
    setEditingGroup(null)
    setSelectedGroupId('')
  }

  const handleSaveGroup = async (userId) => {
    const groupId = selectedGroupId === '' ? null : parseInt(selectedGroupId)
    await onUpdateGroup(userId, groupId)
    setEditingGroup(null)
    setSelectedGroupId('')
  }

  return (
    <div className="list-section">
      <h2 className="section-title">{title}</h2>
      <SearchField
        value={searchValue}
        onChange={onSearchChange}
        placeholder={searchPlaceholder}
      />
      <div className="items-list">
        {users.length === 0 ? (
          <div className="empty-state">
            {title.includes('преподавател') ? 'Преподаватели не найдены' : 'Студенты не найдены'}
          </div>
        ) : (
          users.map(user => (
            <div key={user.id} className="item-card">
              <div className="item-info">
                <div className="item-title">{user.full_name || 'Без имени'}</div>
                <div className="item-subtitle">
                  Логин: {user.login}
                  {editingGroup === user.id ? (
                    <div style={{ marginTop: '8px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <select
                        value={selectedGroupId}
                        onChange={(e) => setSelectedGroupId(e.target.value)}
                        style={{ padding: '4px 8px', borderRadius: '8px', border: '1px solid rgba(17, 91, 73, 0.18)' }}
                      >
                        <option value="">Без группы</option>
                        {groups.map(g => (
                          <option key={g.id} value={g.id}>{g.name}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => handleSaveGroup(user.id)}
                        style={{ padding: '4px 12px', borderRadius: '8px', border: 'none', background: '#0f6b51', color: 'white', cursor: 'pointer' }}
                      >
                        ✓
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        style={{ padding: '4px 12px', borderRadius: '8px', border: 'none', background: '#c0392b', color: 'white', cursor: 'pointer' }}
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    user.group_name && ` | Группа: ${user.group_name}`
                  )}
                </div>
              </div>
              <div className="item-actions">
                {isStudents && editingGroup !== user.id && (
                  <button 
                    className="btn-outline" 
                    onClick={() => handleStartEdit(user)} 
                    title="Изменить группу"
                    style={{ marginRight: '8px', padding: '6px 12px', fontSize: '0.9rem' }}
                  >
                    📝
                  </button>
                )}
                {onSetTemporaryPassword && (
                  <button 
                    className="btn-outline" 
                    onClick={() => {
                      if (window.confirm(`Установить временный пароль для ${user.full_name || user.login}?`)) {
                        onSetTemporaryPassword(user.id)
                      }
                    }} 
                    title="Установить временный пароль"
                    style={{ marginRight: '8px', padding: '6px 12px', fontSize: '0.9rem' }}
                  >
                    🔑
                  </button>
                )}
                <button 
                  className="btn-delete" 
                  onClick={() => onDelete(user.id)} 
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

export default UserList
