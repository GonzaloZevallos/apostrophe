/**
 * The "Time zone" row of Configuración → Negocio: the stored zone's name as saved, on one line and
 * cut with an ellipsis, with no local time (the preview lives on the chooser). It opens the
 * chooser by an in-app link, so its Close goes back here by history.
 */

import { useTranslation } from 'react-i18next'
import { useTimeZone } from '../../api/timeZone'
import Icono from '../../components/Icono'
import InAppLink from '../../components/InAppLink'
import { SETTINGS_TIME_ZONE } from '../../routes'

export default function TimeZoneRow() {
  const { t } = useTranslation()
  const zone = useTimeZone()
  return (
    <InAppLink to={SETTINGS_TIME_ZONE} className="ajustes__item zona-fila">
      <span className="ajustes__item-rotulo zona-fila__rotulo">{t('timeZone:title')}</span>
      <span className="zona-fila__valor">{zone.data?.time_zone}</span>
      <span className="ajustes__item-flecha">
        <Icono nombre="chevron" />
      </span>
    </InAppLink>
  )
}
