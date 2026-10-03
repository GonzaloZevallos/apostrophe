/**
 * The gated branch of the router (plan, "Session": "Only the gated layout runs
 * `me`"). While `me` is pending, nothing under it renders yet. A 401 is already
 * handled by `queryClient.ts`'s global boundary (it redirects before this renders
 * anything); a dropped network shows "Sin conexión" here instead of a blank page
 * that never recovers (`accounts.md`, "No network" — this does not depend on the
 * service worker).
 */

import { useQuery } from '@tanstack/react-query'
import { Outlet } from 'react-router'
import { keys } from '../api/keys'
import { getMe } from '../api/me'
import { NetworkError } from '../api/client'
import SinConexion from '../components/SinConexion'

export default function GatedLayout() {
  const { data, isPending, isError, error } = useQuery({ queryKey: keys.me(), queryFn: getMe })

  if (isPending) return null
  if (isError) {
    if (error instanceof NetworkError) {
      return (
        <main className="pantalla">
          <div className="cuerpo">
            <SinConexion />
          </div>
        </main>
      )
    }
    return null
  }
  if (data === undefined) return null
  return <Outlet context={data} />
}
