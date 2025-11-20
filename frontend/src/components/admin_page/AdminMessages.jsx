function AdminMessages({ message, successMessage }) {
  return (
    <div className="admin-messages">
      {successMessage && (
        <p className="form-message success" role="status">
          {successMessage}
        </p>
      )}
      {message && (
        <p className="form-message error" role="alert">
          {message}
        </p>
      )}
    </div>
  )
}

export default AdminMessages

