function CreateGroupForm({ form, setForm, onSubmit }) {
  return (
    <div className="create-form-section">
      <h2 className="section-title">Создать группу</h2>
      <form onSubmit={onSubmit} className="auth-form">
        <label className="form-field">
          <span className="field-label">Название группы</span>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ name: e.target.value })}
            placeholder="Введите название группы"
            required
          />
        </label>
        <button type="submit" className="btn-primary">Создать группу</button>
      </form>
    </div>
  )
}

export default CreateGroupForm

