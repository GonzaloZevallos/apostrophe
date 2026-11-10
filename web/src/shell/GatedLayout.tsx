/**
 * The gated branch of the router (plan, "Session": "Only the gated layout runs
 * `me`"). While `me` is pending, nothing under it renders yet: the loading shape stands in. A 401 is already
 * handled by `queryClient.ts`'s global boundary, which redirects before anything
 * below needs to render; this layout renders nothing for it rather than flash a
 * retry panel on top of that redirect. A dropped network shows "Sin conexión"
 * (`accounts.md`, "Sin red" — this does not depend on the service worker); any
 * other failure (a 500, above all) shows the generic retry instead of a blank page
 * that never recovers. A successful `me` mounts the flash toast's provider
 * (`flash/`) above everything nested, so a toast armed before `navigate(-1)` shows on
 * the screen history returns to. Nothing under it renders in a language other than the
 * business's: while a chunk for `shown_language` loads it renders the loading shape, and a load that
 * fails or times out ends in English (`i18n/language.ts`); an English business mounts in the
 * same commit its `me` arrives in. Money is the same: nothing renders before `me`, and the module-level
 * money format (`format/money.ts`) is set from it in the render that mounts the outlet, so no child
 * formats an amount in another Business's symbol or decimals (ADR-0081).
 */

import { useQuery } from '@tanstack/react-query'
import { Outlet } from 'react-router'
import { keys } from '../api/keys'
import { getMe } from '../api/me'
import { ApiError, NetworkError } from '../api/client'
import SinConexion from '../components/SinConexion'
import ErrorGenerico from '../components/ErrorGenerico'
import FlashProvider from '../flash/FlashProvider'
import { setMoneyFormat } from '../format/money'
import { useShownLanguage } from '../i18n/language'
import ContentArea from '../components/ContentArea'
import Loading from '../components/Loading'

// The existing loading shape (bars and cards, no text, `aria-busy`): nothing money-bearing renders
// before `me` and the language are ready, and nothing a person could read as data shows meanwhile.
const loadingShape = (
  <ContentArea as="main" className="pantalla">
    <div className="cuerpo">
      <Loading />
    </div>
  </ContentArea>
)

export default function GatedLayout() {
  const { data, isPending, isError, error } = useQuery({ queryKey: keys.me(), queryFn: getMe })
  const languageReady = useShownLanguage(data)

  if (isPending) return loadingShape
  if (isError) {
    if (error instanceof NetworkError) {
      return (
        <ContentArea as="main" className="pantalla">
          <div className="cuerpo">
            <SinConexion />
          </div>
        </ContentArea>
      )
    }
    if (error instanceof ApiError && error.status === 401) return null
    return (
      <ContentArea as="main" className="pantalla">
        <div className="cuerpo">
          <ErrorGenerico />
        </div>
      </ContentArea>
    )
  }
  if (data === undefined || !languageReady) return loadingShape
  // Idempotent and before the children render: the one place the format is taken from `me`.
  setMoneyFormat(data.money_format)
  return (
    <FlashProvider>
      <Outlet context={data} />
    </FlashProvider>
  )
}
