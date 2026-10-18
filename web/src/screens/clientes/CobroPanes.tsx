/**
 * What Clientes draws around Registrar cobro's route (`CobroCompu.dc.html`), as
 * `VarietiesLayout` does for the price form (ADR-0044): on a computer the list and that
 * customer's card sit behind the modal, both `inert` and `aria-hidden`, with the form's host
 * (the route's `Outlet`) as their sibling. On a phone the same wrapper holds the host alone,
 * so a resize across 900 px never remounts it and what was typed is kept.
 */

import { Outlet, useOutletContext } from 'react-router'
import type { Me } from '../../api/me'
import { useViewport } from '../../shell/useViewport'
import ClienteFicha from './ClienteFicha'
import Clientes from './Clientes'

export default function CobroPanes() {
  const me = useOutletContext<Me>()
  const computer = useViewport() === 'computer'
  return (
    <div className={computer ? 'cobro-paneles' : 'cobro-paneles cobro-paneles--solo'}>
      {computer && (
        <div className="cobro-paneles__lista" inert aria-hidden="true">
          <Clientes />
        </div>
      )}
      {computer && (
        <div className="cobro-paneles__detalle" inert aria-hidden="true">
          <ClienteFicha />
        </div>
      )}
      <Outlet context={me} />
    </div>
  )
}
