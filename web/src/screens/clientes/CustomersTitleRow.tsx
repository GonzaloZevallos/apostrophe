/**
 * The Customers title row, drawn once for the list (`Clientes`) and for what sits behind the
 * new-customer sheet (`CustomersBehind`): the title, one link to the new-customer form and,
 * on the list, the avatar. `useViewport` picks the link, so there is exactly one per layout and
 * never a twin hidden with CSS: on the phone the neutral round "+" (D-8ecb8c1d, owner decision
 * Q34: never filled green) because the word does not fit beside the title and the avatar at
 * 320 px; on the computer the worded "+ New customer". Both are named "New customer".
 */

import BotonLink from '../../components/BotonLink'
import SettingsAvatar from '../../components/SettingsAvatar'
import { COMMON_TEXT } from '../../copy/common'
import { CUSTOMER_NEW } from '../../routes'
import { useViewport } from '../../shell/useViewport'

interface CustomersTitleRowProps {
  /** The list draws the avatar; the pane behind the sheet draws no chrome. */
  avatar: boolean
}

export default function CustomersTitleRow({ avatar }: CustomersTitleRowProps) {
  const viewport = useViewport()
  return (
    <div className="clientes__encabezado cabecera-fila">
      <span className="encabezado__titulo">{COMMON_TEXT.customers}</span>
      {viewport === 'phone' ? (
        <BotonLink
          to={CUSTOMER_NEW}
          variant="icon"
          action="add"
          tone="neutral"
          ariaLabel={COMMON_TEXT.newCustomer}
        />
      ) : (
        <BotonLink to={CUSTOMER_NEW} variant="secondary" icon="agregar">
          {COMMON_TEXT.newCustomer}
        </BotonLink>
      )}
      {avatar && <SettingsAvatar />}
    </div>
  )
}
