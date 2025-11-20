import { useState } from 'react'
import MultiSelect from './MultiSelect'

function CreateCourseForm({ form, setForm, onSubmit, groups, teachers }) {
  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  return (
    <div className="create-form-section">
      <h2 className="section-title">Добавить курс</h2>
      <form onSubmit={onSubmit} className="auth-form">
        <label className="form-field">
          <span className="field-label">Название курса</span>
          <input
            type="text"
            value={form.name}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder="Введите название курса"
            required
          />
        </label>
        <label className="form-field">
          <span className="field-label">Описание курса</span>
          <textarea
            value={form.description || ''}
            onChange={(e) => handleChange('description', e.target.value)}
            placeholder="Введите описание курса (необязательно)"
            rows="4"
            style={{
              padding: '0.875rem 1rem',
              borderRadius: '18px',
              border: '1px solid rgba(17, 91, 73, 0.18)',
              fontFamily: 'inherit',
              fontSize: '1rem',
              resize: 'vertical',
              width: '100%',
              boxSizing: 'border-box'
            }}
          />
        </label>
        <div className="form-field">
          <span className="field-label">Группы</span>
          <MultiSelect
            options={groups.map(g => ({ id: g.id, name: g.name }))}
            selectedIds={form.group_ids || []}
            onChange={(ids) => setForm({ ...form, group_ids: ids })}
            placeholder="Выберите группы"
            searchPlaceholder="Поиск групп..."
          />
        </div>
        <div className="form-field">
          <span className="field-label">Преподаватели</span>
          <MultiSelect
            options={teachers.map(t => ({ id: t.id, name: t.full_name || t.login }))}
            selectedIds={form.teacher_ids || []}
            onChange={(ids) => setForm({ ...form, teacher_ids: ids })}
            placeholder="Выберите преподавателей"
            searchPlaceholder="Поиск преподавателей..."
          />
        </div>
        <button type="submit" className="btn-primary">Создать курс</button>
      </form>
    </div>
  )
}

export default CreateCourseForm

