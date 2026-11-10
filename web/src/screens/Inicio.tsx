/**
 * `Inicio` is the panel (`docs/product/results.md`): Hoy · Semana · Mes, switched
 * in the client with no fetch of their own (plan, "Front"), each figure read
 * straight from `GET /panel` (`PanelAnswer`, `web/src/api/fixtures/panel.json`) —
 * this screen never computes, sorts or sign-tests an amount itself (plan
 * invariant: "No screen does arithmetic, sorting, sign tests or comparisons on an
 * amount from the API"). The figures and ranges are drawn by `inicio/InicioPanel.tsx`.
 *
 * The panel query is frozen (`gcTime: 0`, `staleTime: Infinity`, no refetch on
 * focus or reconnect, plan invariant): a remount always re-fetches, so the
 * figures shown are always the current mount's own resolved answer, never a
 * stale one left behind by an earlier mount or another business.
 *
 * Home shows no first-use notice (`registro-unificado.md`, "Se sacan los avisos de primer uso"):
 * it reads neither `GET /first-run` nor `GET /onboarding-progress`, whatever the setup state, and
 * nothing replaces what they drew (ADR-0080, which retires ADR-0046's Home slot). The panel's
 * failure shows the existing "Sin conexión" or the retry.
 *
 * The pinned-catalog notice (plan, "Front"; accounts.md's Inicio rule): a fixed
 * line, never a figure, while `GET /pinned-catalog/status` reads `out_of_date` —
 * before the first Publicar `status` is `null` and nothing shows (PRD, "Before the
 * first Publicar").
 */

import { CATALOG, SETTINGS } from '../routes'
import { useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useOutletContext } from 'react-router'
import BrandMark from '../components/BrandMark'
import InAppLink from '../components/InAppLink'
import { owedPlace, useReturnToPlace } from '../components/useReturnToPlace'
import { peekPaymentReturn } from '../paymentReturn'
import { get, NetworkError } from '../api/client'
import { keys } from '../api/keys'
import type { Me } from '../api/me'
import { panelQuery, type PanelTab } from '../api/panel'
import ErrorGenerico from '../components/ErrorGenerico'
import Loading, { LoadingWhile } from '../components/Loading'
import { AvisoCuerpo } from '../components/AvisoAmbar'
import SinConexion from '../components/SinConexion'
import { initialsOf } from '../format/initials'
import { PINNED_CATALOG_OUT_OF_DATE } from '../copy/inicio'
import InicioPanel from './inicio/InicioPanel'
import { COMMON_TEXT } from '../copy/common'
import ContentArea from '../components/ContentArea'

export { PINNED_CATALOG_OUT_OF_DATE }

interface PinnedCatalogStatus {
  status: { state: 'up_to_date' | 'out_of_date' } | null
}

export default function Inicio() {
  const me = useOutletContext<Me>()
  const [tab, setTab] = useState<PanelTab>('today')

  const panelRead = useQuery(panelQuery)

  const pinnedCatalog = useQuery({
    queryKey: keys.pinnedCatalogStatus(),
    queryFn: () => get<PinnedCatalogStatus>('/pinned-catalog/status'),
  })
  const pinOutOfDate = pinnedCatalog.data?.status?.state === 'out_of_date'

  const root = useRef<HTMLElement>(null)
  const brandBox = useRef<HTMLDivElement>(null)
  // The catalog notice above the panel makes the page taller once it answers (pending, not failed: a
  // failure draws none), so the place is applied after it, never against a shorter page.
  const settled = !pinnedCatalog.isPending
  const ready = panelRead.data !== undefined && !panelRead.isFetching && settled
  useReturnToPlace({ root, ready, fallback: owedPlace })
  const failed = panelRead.isError ? panelRead : undefined
  // The first answers are still on their way; a refresh over the panel already shown is not this.
  const waiting = panelRead.isPending || !settled

  return (
    <ContentArea as="main" className="pantalla" ref={root}>
      <LoadingWhile active={waiting} />
      <div className="cuerpo">
        <div className="inicio__cabecera">
          <div className="inicio__cabecera-titulos">
            <div className="inicio__cabecera-marca" ref={brandBox}>
              <span className="encabezado__negocio">{me.business_name}</span>
              <BrandMark variant="mark" clipRoot={brandBox} />
            </div>
            <span className="encabezado__titulo">{COMMON_TEXT.home}</span>
          </div>
          <InAppLink
            to={SETTINGS}
            aria-label={COMMON_TEXT.settingsFor(me.business_name)}
            className="inicio__avatar"
          >
            {initialsOf(me.business_name)}
          </InAppLink>
        </div>

        {pinOutOfDate && (
          <InAppLink to={CATALOG} className="aviso-ambar aviso-ambar--atencion" role="status">
            <AvisoCuerpo attention>
              <span className="aviso-ambar__titulo">{PINNED_CATALOG_OUT_OF_DATE}</span>
            </AvisoCuerpo>
          </InAppLink>
        )}

        {failed !== undefined && failed.error instanceof NetworkError && <SinConexion />}
        {failed !== undefined && !(failed.error instanceof NetworkError) && <ErrorGenerico />}

        {/* A saved payment drops the cached panel and leaves the hand-off: Home reads again and the
            catalog notice above it makes the page taller once it answers. While that hand-off waits for
            its place, the marker tells the scroll owner (`ScrollSync`) the page is not at its final
            height yet. A first visit shows none: it has no place to return to. */}
        {!ready && failed === undefined && peekPaymentReturn() !== null && <Loading />}
        {panelRead.data !== undefined && (
          <InicioPanel panel={panelRead.data} tab={tab} onTab={setTab} today={me.today} />
        )}
      </div>
    </ContentArea>
  )
}
