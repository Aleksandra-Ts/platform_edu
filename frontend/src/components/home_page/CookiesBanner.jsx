import { useState, useEffect } from 'react'

function CookiesBanner() {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Проверяем, было ли согласие уже дано
    const cookiesAccepted = localStorage.getItem('cookiesAccepted')
    if (!cookiesAccepted) {
      // Показываем баннер с небольшой задержкой
      setTimeout(() => {
        setIsVisible(true)
      }, 1000)
    }
  }, [])

  const handleAccept = () => {
    localStorage.setItem('cookiesAccepted', 'true')
    setIsVisible(false)
  }

  if (!isVisible) return null

  return (
    <div className={`cookies-banner ${isVisible ? 'visible' : ''}`}>
      <div className="cookies-content">
        <p>
          Мы используем cookies для улучшения работы сайта и персонализации контента.
          Продолжая использовать сайт, вы соглашаетесь с использованием cookies.
        </p>
        <button className="cookies-btn" onClick={handleAccept}>
          Принять
        </button>
      </div>
    </div>
  )
}

export default CookiesBanner

