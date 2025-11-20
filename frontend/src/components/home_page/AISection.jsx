import { useEffect, useState, useRef } from 'react'

function AISection() {
  const [isVisible, setIsVisible] = useState(false)
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

  return (
    <section
      ref={sectionRef}
      id="ai-section"
      className={`ai-landing ${isVisible ? 'visible' : ''}`}
    >
      <div className="ai-content-wrapper">
        <div className="video-container">
          <video className="ai-video" autoPlay muted loop playsInline>
            <source src="/videos/ai_assistant.mp4" type="video/mp4" />
            Ваш браузер не поддерживает видео.
          </video>
        </div>
        <div className="ai-description">
          <h2 className="ai-title">Умный ИИ ассистент</h2>
          <p className="ai-text">
            <strong>Ассистент помогает разобраться даже в самых сложных предметах,</strong> будь то математика, физика, химия или иностранные языки.
            Он оперативно решает задачи, объясняет непонятные моменты и мотивирует двигаться вперед.
            <strong>Удобный интерфейс позволяет легко ориентироваться среди функций и возможностей программы,</strong>
            обеспечивая комфортное взаимодействие.
          </p>
        </div>
      </div>
    </section>
  )
}

export default AISection

