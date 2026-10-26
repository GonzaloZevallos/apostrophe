/**
 * The /clientes layout route (plan, "Search"): holds the search query so it
 * survives going from the list to a card or a form and back, then forwards `me`
 * on to whichever child route is active (`Shell` already does the same for its
 * own `Outlet`).
 *
 * On a computer Clientes is two panes (`ClientesCompu.dc.html`): the list stays on the left
 * while a customer's card fills the right one, and `/customers` alone selects nobody, so its
 * right pane stays empty. The forms keep the whole width (on a phone a sheet over its parent, `BehindPane`), and Registrar cobro is a modal over both panes (`CobroPanes`). The selection
 * is the URL.
 */

import { useState } from 'react'
import { Outlet, useMatch, useOutletContext } from 'react-router'
import type { Me } from '../../api/me'
import BehindPane from '../../components/BehindPane'
import { CUSTOMER, CUSTOMER_EDIT, CUSTOMER_NEW, CUSTOMER_PAYMENT, CUSTOMERS } from '../../routes'
import { useViewport } from '../../shell/useViewport'
import Clientes from './Clientes'
import { CustomerSearchContext } from './CustomerSearch'
import CobroPanes from './CobroPanes'
import CustomerCardBehind from './CustomerCardBehind'
import CustomersBehind from './CustomersBehind'

export default function ClientesLayout() {
  const me = useOutletContext<Me>()
  const [query, setQuery] = useState('')
  const computer = useViewport() === 'computer'
  const onList = useMatch(CUSTOMERS) !== null
  const customerId = useMatch(CUSTOMER)?.params.id
  const onCard = customerId !== undefined && /^[0-9]+$/.test(customerId)
  // Registrar cobro is a modal over the list and the card on a computer (ADR-0044).
  const onPayment = useMatch(CUSTOMER_PAYMENT) !== null
  // On a phone the customer form is a sheet over its parent (ADR-0053): new over Customers, edit
  // over the customer's card. The pane comes first and `{!computer && …}` leaves its place, so the
  // form keeps one index on both viewports.
  const onNew = useMatch(CUSTOMER_NEW) !== null
  const editedId = useMatch(CUSTOMER_EDIT)?.params.id
  const onEdit = editedId !== undefined && /^[0-9]+$/.test(editedId)

  return (
    <CustomerSearchContext.Provider value={{ query, setQuery }}>
      {onPayment ? (
        <CobroPanes />
      ) : computer && (onList || onCard) ? (
        <div className="clientes-paneles">
          <div className="clientes-paneles__lista">
            <Clientes />
          </div>
          <div className="clientes-paneles__detalle">{onCard && <Outlet context={me} />}</div>
        </div>
      ) : onNew || onEdit ? (
        <>
          {!computer && (
            <BehindPane>{onEdit ? <CustomerCardBehind customerId={editedId} /> : <CustomersBehind />}</BehindPane>
          )}
          <Outlet context={me} />
        </>
      ) : (
        <Outlet context={me} />
      )}
    </CustomerSearchContext.Provider>
  )
}
