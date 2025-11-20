function SearchField({ value, onChange, placeholder }) {
  return (
    <div className="search-field">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  )
}

export default SearchField

