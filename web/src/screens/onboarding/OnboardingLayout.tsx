/**
 * The frame of every Onboarding path (`/onboarding/*`), outside the shell: no bar, no side
 * rail, no "+ Nueva venta", one centred phone-width column on every viewport. It asks
 * `/onboarding-progress` once and hands the answer to the step below.
 *
 * Any Onboarding path goes to Inicio when the business is not offered the Onboarding or it
 * is over (judged when the Onboarding opened). The one exception is "Listo": it is over by definition, so it opens only when
 * entered with the bare `{ listo: true }` flag a write that answered `over: true` sets;
 * without it (a reload, a deep link) it goes to Inicio too.
 */

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Navigate, Outlet, useLocation, useOutletContext } from 'react-router'
import { NetworkError } from '../../api/client'
import type { Me } from '../../api/me'
import { onboardingProgressQuery } from '../../api/onboarding'
import ErrorGenerico from '../../components/ErrorGenerico'
import Loading from '../../components/Loading'
import SinConexion from '../../components/SinConexion'
import { HOME, ONBOARDING_DONE } from '../../routes'
import { isListoState } from './afterProgress'
import type { OnboardingContext } from './onboardingContext'

export default function OnboardingLayout() {
  const me = useOutletContext<Me>()
  const location = useLocation()
  const query = useQuery(onboardingProgressQuery)
  // Whether the business had no Onboarding to walk when this one opened: a write that ends
  // it (`over: true`) must reach "Listo", not bounce off the step it came from.
  const [closedOnEntry, setClosedOnEntry] = useState<boolean | null>(null)

  if (query.isError) {
    return (
      <main className="pantalla onboarding">
        <div className="onboarding__columna">
          {query.error instanceof NetworkError ? <SinConexion /> : <ErrorGenerico />}
        </div>
      </main>
    )
  }
  if (query.data === undefined) return <Loading />

  const progress = query.data
  if (closedOnEntry === null) setClosedOnEntry(!progress.offered || progress.over)
  const isListo = location.pathname === ONBOARDING_DONE
  const leaves = isListo
    ? !isListoState(location.state) || !progress.offered
    : closedOnEntry !== false
  if (leaves) return <Navigate to={HOME} replace />

  const context: OnboardingContext = { me, progress }
  return <Outlet context={context} />
}
