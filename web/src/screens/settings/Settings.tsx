import ContentArea from '../../components/ContentArea'
import { useTranslation } from 'react-i18next'
import { useViewport } from '../../shell/useViewport'
import SettingsHome from './SettingsHome'

// The Settings route entry: the phone gets the home; on a computer the list is `SettingsLayout`'s
// side column, so this is the pane's prompt until a setting is chosen.
export default function Settings() {
  const { t } = useTranslation()

  return useViewport() === 'computer' ? (
    <ContentArea as="main" className="pantalla">
      <p>{t('settings:panePrompt')}</p>
    </ContentArea>
  ) : (
    <SettingsHome />
  )
}
