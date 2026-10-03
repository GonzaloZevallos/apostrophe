/**
 * The `/clientes` layout route (plan, "Search"): holds the search query so it
 * survives going from the list to a card or a form and back, then forwards `me`
 * on to whichever child route is active (`Shell` already does the same for its
 * own `Outlet`).
 */

import { useState } from 'react'
import { Outlet, useOutletContext } from 'react-router'
import type { Me } from '../../api/me'
import { CustomerSearchContext } from './CustomerSearch'

export default function ClientesLayout() {
  const me = useOutletContext<Me>()
  const [query, setQuery] = useState('')

  return (
    <CustomerSearchContext.Provider value={{ query, setQuery }}>
      <Outlet context={me} />
    </CustomerSearchContext.Provider>
  )
}
