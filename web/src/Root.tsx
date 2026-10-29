/**
 * The route tree's own root element (`router.tsx`): `RouterSync` keeps
 * `queryClient.ts`'s notion of "where am I" current, so a 401 on a gated call
 * knows whether the screen it happened on is public (plan, invariants: "a 401
 * does nothing on a public route"). The offline banner renders once for every
 * route, public or gated. `ScrollSync` decides where the document is scrolled on each location
 * change (ADR-0063).
 */

import { useEffect } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router'
import SinConexion from './components/SinConexion'
import { setCurrentPath, setNavigate } from './queryClient'
import ScrollSync from './shell/ScrollSync'
import { useOnline } from './useOnline'

function RouterSync() {
  const location = useLocation()
  const navigate = useNavigate()
  useEffect(() => {
    setCurrentPath(location.pathname)
    setNavigate(navigate)
  }, [location.pathname, navigate])
  return null
}

function OfflineBanner() {
  const online = useOnline()
  if (online) return null
  return (
    <div className="aviso-flotante">
      <SinConexion />
    </div>
  )
}

export default function Root() {
  return (
    <>
      <RouterSync />
      <ScrollSync />
      <OfflineBanner />
      <Outlet />
    </>
  )
}
