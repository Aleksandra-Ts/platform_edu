import FirstLanding from '../components/home_page/FirstLanding'
import AISection from '../components/home_page/AISection'
import FeaturesSection from '../components/home_page/FeaturesSection'
import CookiesBanner from '../components/home_page/CookiesBanner'
import Footer from '../components/home_page/Footer'
import '../styles/home.css'

function Home() {
  return (
    <>
      <FirstLanding />
      <AISection />
      <FeaturesSection />
      <Footer />
      <CookiesBanner />
    </>
  )
}

export default Home
