import { useState } from 'react'
import CreateCourseForm from './CreateCourseForm'
import MultiSelect from './MultiSelect'
import CoursePreview from './CoursePreview'

function CoursesTab({
  form,
  setForm,
  onSubmit,
  courses,
  groups,
  teachers,
  searchValue,
  onSearchChange,
  onEdit,
  onDelete
}) {
  const [editingCourse, setEditingCourse] = useState(null)
  const [editForm, setEditForm] = useState({ name: '', description: '', group_ids: [], teacher_ids: [] })
  const [previewCourseId, setPreviewCourseId] = useState(null)

  const handleStartEdit = (course) => {
    setEditingCourse(course.id)
    setEditForm({
      name: course.name,
      description: course.description || '',
      group_ids: course.group_ids || [],
      teacher_ids: course.teacher_ids || []
    })
  }

  const handleCancelEdit = () => {
    setEditingCourse(null)
    setEditForm({ name: '', description: '', group_ids: [], teacher_ids: [] })
  }

  const handleSaveEdit = async (courseId) => {
    await onEdit(courseId, editForm)
    setEditingCourse(null)
    setEditForm({ name: '', description: '', group_ids: [], teacher_ids: [] })
  }

  return (
    <div className="tab-content active">
      <div className="tab-section">
        <CreateCourseForm
          form={form}
          setForm={setForm}
          onSubmit={onSubmit}
          groups={groups}
          teachers={teachers}
        />
        <div className="list-section">
          <h2 className="section-title">Список курсов</h2>
          <div className="search-field">
            <input
              type="text"
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Поиск по названию, описанию..."
            />
          </div>
          <div className="items-list">
            {courses.length === 0 ? (
              <div className="empty-state">Курсы не найдены</div>
            ) : (
              courses.map(course => (
                <div 
                  key={course.id} 
                  className="item-card"
                  style={{ cursor: editingCourse !== course.id ? 'pointer' : 'default' }}
                  onClick={editingCourse !== course.id ? () => setPreviewCourseId(course.id) : undefined}
                >
                  <div className="item-info" style={{ flex: 1 }}>
                    {editingCourse === course.id ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <input
                          type="text"
                          value={editForm.name}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          placeholder="Название курса"
                          style={{
                            padding: '8px 12px',
                            borderRadius: '8px',
                            border: '1px solid rgba(17, 91, 73, 0.18)',
                            fontSize: '1rem'
                          }}
                        />
                        <textarea
                          value={editForm.description || ''}
                          onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                          placeholder="Описание курса"
                          rows="3"
                          style={{
                            padding: '8px 12px',
                            borderRadius: '8px',
                            border: '1px solid rgba(17, 91, 73, 0.18)',
                            fontSize: '1rem',
                            resize: 'vertical',
                            fontFamily: 'inherit'
                          }}
                        />
                        <div>
                          <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem', color: '#666' }}>
                            Группы:
                          </label>
                          <MultiSelect
                            options={groups.map(g => ({ id: g.id, name: g.name }))}
                            selectedIds={editForm.group_ids}
                            onChange={(ids) => setEditForm({ ...editForm, group_ids: ids })}
                            placeholder="Выберите группы"
                            searchPlaceholder="Поиск групп..."
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem', color: '#666' }}>
                            Преподаватели:
                          </label>
                          <MultiSelect
                            options={teachers.map(t => ({ id: t.id, name: t.full_name || t.login }))}
                            selectedIds={editForm.teacher_ids}
                            onChange={(ids) => setEditForm({ ...editForm, teacher_ids: ids })}
                            placeholder="Выберите преподавателей"
                            searchPlaceholder="Поиск преподавателей..."
                          />
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={() => handleSaveEdit(course.id)}
                            style={{
                              padding: '8px 16px',
                              borderRadius: '8px',
                              border: 'none',
                              background: '#0f6b51',
                              color: 'white',
                              cursor: 'pointer'
                            }}
                          >
                            Сохранить
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            style={{
                              padding: '8px 16px',
                              borderRadius: '8px',
                              border: 'none',
                              background: '#c0392b',
                              color: 'white',
                              cursor: 'pointer'
                            }}
                          >
                            Отмена
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="item-title">{course.name}</div>
                        <div className="item-subtitle" style={{ marginTop: '8px' }}>
                          {course.group_names && course.group_names.length > 0 ? (
                            <span>Группы: {course.group_names.join(', ')}</span>
                          ) : (
                            <span style={{ color: '#999' }}>Группы не назначены</span>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                  {editingCourse !== course.id && (
                    <div className="item-actions">
                      <button
                        className="btn-outline"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleStartEdit(course)
                        }}
                        title="Редактировать"
                        style={{ marginRight: '8px', padding: '6px 12px', fontSize: '0.9rem' }}
                      >
                        ✏️
                      </button>
                      <button
                        className="btn-delete"
                        onClick={(e) => {
                          e.stopPropagation()
                          onDelete(course.id)
                        }}
                        title="Удалить"
                      >
                        🗑️
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      {previewCourseId && (
        <CoursePreview
          courseId={previewCourseId}
          onClose={() => setPreviewCourseId(null)}
        />
      )}
    </div>
  )
}

export default CoursesTab

