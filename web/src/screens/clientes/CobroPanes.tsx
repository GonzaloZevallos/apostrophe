/**
 * What Clientes draws around Registrar cobro's route (`CobroCompu.dc.html`), as
 * `VarietiesLayout` does for the price form (ADR-0044): the screen the payment was opened
 * from sits behind the host, `inert` and `aria-hidden`, with the form's host (the route's
 * `Outlet`) as its sibling. Which screen that is comes from `location.state.underneath`,
 * read only through `readPaymentUnderneath` (the customer's card when it says nothing):
 *   - `customers`: the live list; the detail pane stays empty on a computer;
 *   - `card`: the list and that customer's card on a computer, the card alone on a phone;
 *   - `home`: Home's presentational background (`InicioFondo`).
 * The wrapper and its children keep one place each on both viewports (a pane that is not
 * drawn is `false`, not a different element), so a resize across 900 px never remounts the
 * host and what was typed is kept. The background never exits or navigates: the host owns
 * gone, error and network alone.
 */

import { Outlet, useLocation, useOutletContext } from 'react-router'
import type { Me } from '../../api/me'
import { readPaymentUnderneath } from '../../routes'
import { useViewport } from '../../shell/useViewport'
import InicioFondo from '../inicio/InicioFondo'
import ClienteFicha from './ClienteFicha'
import Clientes from './Clientes'

export default function CobroPanes() {
  const me = useOutletContext<Me>()
  const computer = useViewport() === 'computer'
  const underneath = readPaymentUnderneath(useLocation().state)
  const list = underneath === 'customers' || (underneath === 'card' && computer)
  const detail = underneath === 'card' || (underneath === 'customers' && computer)
  return (
    <div className={computer ? 'cobro-paneles' : 'cobro-paneles cobro-paneles--solo'}>
      {list && (
        <div className="cobro-paneles__lista" inert aria-hidden="true">
          <Clientes />
        </div>
      )}
      {detail && (
        <div className="cobro-paneles__detalle" inert aria-hidden="true">
          {underneath === 'card' && <ClienteFicha />}
        </div>
      )}
      {underneath === 'home' && (
        <div className="cobro-paneles__inicio" inert aria-hidden="true">
          <InicioFondo />
        </div>
      )}
      <Outlet context={me} />
    </div>
  )
}
