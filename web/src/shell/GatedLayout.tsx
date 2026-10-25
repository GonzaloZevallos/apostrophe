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
 * the screen history returns to. Nothing under it renders in a language other than the
 * business's: while a chunk for `shown_language` loads it renders nothing, and a load that
 * fails or times out ends in English (`i18n/language.ts`); an English business mounts in the
 * same commit its `me` arrives in.
 */

import { useQuery } from '@tanstack/react-query'
import { Outlet } from 'react-router'
import { keys } from '../api/keys'
import { getMe } from '../api/me'
import { ApiError, NetworkError } from '../api/client'
import SinConexion from '../components/SinConexion'
import ErrorGenerico from '../components/ErrorGenerico'
import FlashProvider from '../flash/FlashProvider'
import { useShownLanguage } from '../i18n/language'

export default function GatedLayout() {
  const { data, isPending, isError, error } = useQuery({ queryKey: keys.me(), queryFn: getMe })
  const languageReady = useShownLanguage(data)

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
  if (data === undefined || !languageReady) return null
  return (
    <FlashProvider>
      <Outlet context={data} />
    </FlashProvider>
  )
}
