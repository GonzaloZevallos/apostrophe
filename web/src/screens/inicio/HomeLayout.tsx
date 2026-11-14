/**
 * The layout route of Home and Analysis (GH-723, "El encabezado de Home y Analysis"): the one
 * header both views share, drawn above whichever body is active, outside every content area so
 * it is there whatever state the view under it is in. It holds no state and reads nothing the
 * session did not load before any screen, so it never waits for the Panel or Analysis data.
 *
 * On the phone the header is a date line (today's date, a figure), an empty inert slot where
 * the drawing keeps "Editar", the avatar, then the Today | Analysis segment and the screen's
 * one h1, visually hidden: the phone shows no business name, no mark and no visible title. On
 * the computer it is what each screen always drew: on Home the business name above the visible
 * title, on Analysis the title alone. It is a plain div, not a `<header>` (the chrome's own is
 * the only banner the Mobile check looks for) and it scrolls with the page.
 *
 * Expenses is never wrapped: it is a plain sibling of this route in `router.tsx`.
 */

import { Outlet, useOutletContext } from 'react-router'
import { useTranslation } from 'react-i18next'
import type { Me } from '../../api/me'
import HomeViewSwitch from '../../components/HomeViewSwitch'
import SettingsAvatar from '../../components/SettingsAvatar'
import { formatDate } from '../../format/dates'
import { useLeafScreen } from '../../shell/useLeafScreen'
import { useViewport } from '../../shell/useViewport'

export default function HomeLayout() {
  const { t } = useTranslation()
  const me = useOutletContext<Me>()
  const screen = useLeafScreen()
  const phone = useViewport() === 'phone'

  return (
    <>
      <div className="inicio-cabecera">
        {phone && (
          <>
            <div className="inicio-cabecera__fila">
              <span className="inicio-cabecera__fecha titulo">{formatDate(me.today, me.today)}</span>
              <span className="inicio-cabecera__editar" aria-hidden="true" />
              <SettingsAvatar />
            </div>
            <HomeViewSwitch />
          </>
        )}
        {!phone && screen.id === 'home' && <span className="encabezado__negocio">{me.business_name}</span>}
        <h1 className={phone ? 'encabezado__titulo visualmente-oculto' : 'encabezado__titulo'}>{t(screen.titleKey)}</h1>
      </div>
      <Outlet context={me} />
    </>
  )
}
