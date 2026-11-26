/**
 * The route tree's own root element (`router.tsx`): `RouterSync` keeps
 * `queryClient.ts`'s notion of "where am I" current, so a 401 on a gated call
 * knows whether the screen it happened on is public (plan, invariants: "a 401
 * does nothing on a public route"). The offline banner renders once for every
 * route, public or gated. `ScrollSync` is the one owner of the page's scroll on a change of
 * screen (ADR-0069), for the same reason: one mount above both trees.
 */

import { useEffect } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router'
import { setCurrentPath, setNavigate } from './queryClient'
import ScrollSync from './shell/ScrollSync'
import { OfflineBanner, OfflineBannerSlotProvider } from './shell/offlineBannerSlot'
import { useOfflineBannerSlotClaimed } from './shell/useOfflineBannerSlot'
import { useViewport } from './shell/useViewport'

function RouterSync() {
  const location = useLocation()
  const navigate = useNavigate()
  useEffect(() => {
    setCurrentPath(location.pathname)
    setNavigate(navigate)
  }, [location.pathname, navigate])
  return null
}

/** The phone's notice floats; a computer's is drawn by the Shell, or, with no Shell, here as a row. */
function RootBanner() {
  const viewport = useViewport()
  const claimed = useOfflineBannerSlotClaimed()
  if (viewport === 'phone') return <OfflineBanner variant="flotante" />
  return claimed ? null : <OfflineBanner variant="pagina" />
}

export default function Root() {
  return (
    <OfflineBannerSlotProvider>
      <RouterSync />
      <ScrollSync />
      <RootBanner />
      <Outlet />
    </OfflineBannerSlotProvider>
  )
}
