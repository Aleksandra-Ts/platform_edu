import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

function FirstLanding() {
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()

  const handleStartLearning = (e) => {
    e.preventDefault()
    if (isAuthenticated()) {
      // Редирект на dashboard в зависимости от роли
      const role = localStorage.getItem('role')
      if (role === 'teacher') {
        navigate('/dashboard')
      } else if (role === 'student') {
        navigate('/student-dashboard')
      } else if (role === 'admin') {
        navigate('/admin')
      } else {
        navigate('/profile')
      }
    } else {
      navigate('/login')
    }
  }

  const handleScrollDown = () => {
    document.querySelector('#ai-section')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <section className="first-landing">
      <div className="decor-circle circle-1"></div>
      <div className="decor-circle circle-2"></div>
      <div className="decor-circle circle-3"></div>

      <div className="content-wrapper">
        <div className="text-content">
          <div className="title-wrapper">
            <h1 className="library-title first-line">Умный</h1>
            <h1 className="library-title second-line">конспект</h1>
          </div>
          <p className="subtitle">Все курсы в одном месте. Изучайте где угодно, когда угодно.</p>
          <a href="#" className="btn" onClick={handleStartLearning} id="start-learning-btn">
            Начать изучение
          </a>
        </div>

        <div className="image-container">
          <div className="blob-frame">
            <div className="blob-content"></div>
          </div>
        </div>
      </div>

      <div className="scroll-down" id="scroll-down" onClick={handleScrollDown}>
        <span>Листайте вниз</span>
        <div className="arrow-down"></div>
      </div>
    </section>
  )
}

export default FirstLanding

