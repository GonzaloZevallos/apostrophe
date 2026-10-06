/**
 * The gated branch of the router (plan, "Session": "Only the gated layout runs
 * `me`"). While `me` is pending, nothing under it renders yet. A 401 is already
 * handled by `queryClient.ts`'s global boundary, which redirects before anything
 * below needs to render; this layout renders nothing for it rather than flash a
 * retry panel on top of that redirect. A dropped network shows "Sin conexión"
 * (`accounts.md`, "No network" — this does not depend on the service worker); any
 * other failure (a 500, above all) shows the generic retry instead of a blank page
 * that never recovers. A successful `me` mounts the flash toast's provider
 * (`flash/`) above everything nested, so a toast armed before `navigate(-1)` shows on
 * the screen history returns to.
 */

import { useQuery } from '@tanstack/react-query'
import { Outlet } from 'react-router'
import { keys } from '../api/keys'
import { getMe } from '../api/me'
import { ApiError, NetworkError } from '../api/client'
import SinConexion from '../components/SinConexion'
import ErrorGenerico from '../components/ErrorGenerico'
import FlashProvider from '../flash/FlashProvider'

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
    if (error instanceof ApiError && error.status === 401) return null
    return (
      <main className="pantalla">
        <div className="cuerpo">
          <ErrorGenerico />
        </div>
      </main>
    )
  }
  if (data === undefined) return null
  return (
    <FlashProvider>
      <Outlet context={data} />
    </FlashProvider>
  )
}
