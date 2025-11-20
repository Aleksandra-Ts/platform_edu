import AuthHeader from '../components/auth_page/AuthHeader'
import LoginForm from '../components/auth_page/LoginForm'
import AuthFooter from '../components/auth_page/AuthFooter'
import AuthAside from '../components/auth_page/AuthAside'
import '../styles/auth.css'

function Login() {
  return (
    <main className="auth-layout">
      <section className="auth-card">
        <AuthHeader
          title="Вход"
          subtitle="Введите данные своей учётной записи, чтобы продолжить обучение."
        />
        <LoginForm />
        <AuthFooter />
      </section>
      <AuthAside />
    </main>
  )
}

export default Login
