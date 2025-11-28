import { useAuth } from '../../hooks/useAuth'
import { useNavigation } from '../../hooks/useNavigation'
import Breadcrumbs from '../common/Breadcrumbs'

function ProfileHeader() {
  const { goHome } = useNavigation()

  return (
    <div className="profile-head">
      <Breadcrumbs
        items={[
          { label: 'Главная', onClick: goHome },
          { label: 'Профиль', active: true }
        ]}
      />
    </div>
  )
}

export default ProfileHeader

