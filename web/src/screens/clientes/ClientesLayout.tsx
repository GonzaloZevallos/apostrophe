/**
 * The /clientes layout route (plan, "Search"): holds the search query so it
 * survives going from the list to a card or a form and back, then forwards `me`
 * on to whichever child route is active (`Shell` already does the same for its
 * own `Outlet`).
 *
 * On a computer Clientes is two panes (`ClientesCompu.dc.html`): the list stays on the left
 * while a customer's card fills the right one, and `/customers` alone selects nobody, so its
 * right pane stays empty. The forms and Registrar cobro keep the whole width. The selection
 * is the URL.
 */

import { useState } from 'react'
import { Outlet, useMatch, useOutletContext } from 'react-router'
import type { Me } from '../../api/me'
import { CUSTOMER, CUSTOMERS } from '../../routes'
import { useViewport } from '../../shell/useViewport'
import Clientes from './Clientes'
import { CustomerSearchContext } from './CustomerSearch'

export default function ClientesLayout() {
  const me = useOutletContext<Me>()
  const [query, setQuery] = useState('')
  const computer = useViewport() === 'computer'
  const onList = useMatch(CUSTOMERS) !== null
  const customerId = useMatch(CUSTOMER)?.params.id
  const onCard = customerId !== undefined && /^[0-9]+$/.test(customerId)

  return (
    <CustomerSearchContext.Provider value={{ query, setQuery }}>
      {computer && (onList || onCard) ? (
        <div className="clientes-paneles">
          <div className="clientes-paneles__lista">
            <Clientes />
          </div>
          <div className="clientes-paneles__detalle">{onCard && <Outlet context={me} />}</div>
        </div>
      ) : (
        <Outlet context={me} />
      )}
    </CustomerSearchContext.Provider>
  )
}
