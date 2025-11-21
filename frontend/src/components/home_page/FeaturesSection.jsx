import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

function FeaturesSection() {
  const [isVisible, setIsVisible] = useState(false)
  const { isAuthenticated } = useAuth()
  const sectionRef = useRef(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setIsVisible(true)
        })
      },
      { threshold: 0.1 }
    )

    if (sectionRef.current) observer.observe(sectionRef.current)

    return () => {
      observer.disconnect()
    }
  }, [])

  const features = [
    {
      icon: '📚',
      title: 'Нужные для учёбы материалы',
      description: 'Все нужные для изучения курса материалы в формате презентаций и видео на одной платформе'
    },
    {
      icon: '🔍',
      title: 'Интерактивные конспекты',
      description: 'Если что-то оказалось непонятно в уроке, Гигачат всё объяснит и поможет изучить материал'
    },
    {
      icon: '📱',
      title: 'Доступ с любых устройств',
      description: 'Изучайте курс на компьютере, планшете или смартфоне. Конспекты и уроки всегда с вами'
    }
  ]

  return (
    <section
      ref={sectionRef}
      id="second-section"
      className={`second-landing ${isVisible ? 'visible' : ''}`}
    >
      <div className="features-container">
        <h2 className="section-title">Наши возможности</h2>
        <div className="features-grid">
          {features.map((feature, index) => (
            <div key={index} className="feature-card">
              <div className="feature-icon">{feature.icon}</div>
              <h3 className="feature-title">{feature.title}</h3>
              <p className="feature-description">{feature.description}</p>
            </div>
          ))}
        </div>
        <div className="auth-section">
          <h3 className="auth-title">Начать обучение?</h3>
          <div className="auth-buttons">
            {!isAuthenticated() ? (
              <Link to="/login" className="auth-btn login-btn" id="auth-login-btn">
                Войти
              </Link>
            ) : (
              <Link to="/profile" className="auth-btn profile-btn" id="auth-profile-btn">
                Профиль
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

export default FeaturesSection

