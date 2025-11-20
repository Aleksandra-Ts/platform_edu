function PasswordField({ value, onChange, onGenerate }) {
  return (
    <div className="password-field-wrapper">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Введите или сгенерируйте"
        required
      />
      <button
        type="button"
        className="password-generate-btn"
        onClick={onGenerate}
      >
        🎲
      </button>
    </div>
  )
}

export default PasswordField

