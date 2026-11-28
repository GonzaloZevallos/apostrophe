/**
 * `SettingsHome`, the phone Settings home (`Configuracion.dc.html`): the title, the Business card,
 * then `SettingsNav` (the three shortcuts and the five groups). The screen reads the rows' context
 * through `useSettingsRowContext` (`/business` and `/pricing-settings`) and hands the list its
 * values as plain context; each is `undefined` until it has answered, so a conditional row never
 * shows early. The screen owns the `ContentArea`, so it is the one that calls `useLoading`.
 *
 * The card is read-only: no role, link, button or chevron. Its count slot has a fixed height and
 * stays empty while the read is pending and after it fails, so a wrong count never shows and
 * nothing moves when it fills. Every text is a copy key; every row, icon and address is the
 * registry's, read by the list.
 */

import { useTranslation } from 'react-i18next'
import { useOutletContext } from 'react-router'
import type { Me } from '../../api/me'
import ContentArea from '../../components/ContentArea'
import { useLoading } from '../../components/useLoading'
import SettingsNav from './SettingsNav'
import { useSettingsRowContext } from './useSettingsRowContext'

export default function SettingsHome() {
  return (
    <ContentArea as="main" className="pantalla">
      <HomeBody />
    </ContentArea>
  )
}

/** Below `ContentArea`, so `useLoading` counts on the area that owns `aria-busy`. */
function HomeBody() {
  const { t } = useTranslation()
  const me = useOutletContext<Me>()
  const { ctx, userCount, isPending } = useSettingsRowContext()
  useLoading(isPending)

  return (
    <div className="cuerpo ajustes-inicio__marco">
      <h1 className="ajustes-inicio__encabezado">{t('settings:home.title')}</h1>
      <SettingsNav ctx={ctx} card={{ businessName: me.business_name, userCount }} />
    </div>
  )
}
