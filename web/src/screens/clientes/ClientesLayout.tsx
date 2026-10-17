/**
 * The /clientes layout route (plan, "Search"): holds the search query so it
 * survives going from the list to a card or a form and back, then forwards `me`
 * on to whichever child route is active (`Shell` already does the same for its
 * own `Outlet`).
 */

import { useState } from 'react'
import { Outlet, useMatch, useOutletContext } from 'react-router'
import type { Me } from '../../api/me'
import { CUSTOMER_PAYMENT } from '../../routes'
import { CustomerSearchContext } from './CustomerSearch'
import CobroPanes from './CobroPanes'

export default function ClientesLayout() {
  const me = useOutletContext<Me>()
  const [query, setQuery] = useState('')
  // Registrar cobro is a modal over the list and the card on a computer (ADR-0044).
  const onPayment = useMatch(CUSTOMER_PAYMENT) !== null

  return (
    <CustomerSearchContext.Provider value={{ query, setQuery }}>
      {onPayment ? <CobroPanes /> : <Outlet context={me} />}
    </CustomerSearchContext.Provider>
  )
}
