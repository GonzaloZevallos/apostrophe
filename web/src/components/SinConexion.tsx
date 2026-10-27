/**
 * The "Sin conexión" state of `Estados` (`accounts.md`, "No network"): fixed copy,
 * no data of its own. Shown wherever a request fails because the network dropped, or
 * the browser's own `online`/`offline` signal says so (`useOnline`) — never a success
 * toast, never the generic server-error retry.
 */

import { useTranslation } from 'react-i18next'
import AvisoAmbar from './AvisoAmbar'

export default function SinConexion() {
  const { t } = useTranslation()
  return (
    <AvisoAmbar attention role="status">
      <span className="aviso-ambar__titulo">{t('common:offline')}</span>
    </AvisoAmbar>
  )
}
