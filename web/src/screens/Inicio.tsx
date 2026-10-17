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
 * "Arrancá por las variedades" sits above the panel instead of replacing it (PM,
 * adjustment 5): a business can have history and no price today, and its figures
 * are real.
 *
 * Slot 1 is `inicioNotices`' call (results.md's order): "Seguí con la configuración" while
 * the Onboarding is offered and not over, otherwise "Arrancá por las variedades". It stays
 * empty until `/panel` and `/onboarding-progress` have both answered, so an Onboarding
 * business never flashes "Arrancá" whichever answer comes first; a failure of either shows
 * the existing "Sin conexión" or the generic retry.
 *
 * The pinned-catalog notice (plan, "Front"; accounts.md's Inicio rule): a fixed
 * line, never a figure, while `GET /pinned-catalog/status` reads `out_of_date` —
 * before the first Publicar `status` is `null` and nothing shows (PRD, "Before the
 * first Publicar").
 */

import { CATALOG, SETTINGS } from '../routes'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useOutletContext } from 'react-router'
import InAppLink from '../components/InAppLink'
import { get, NetworkError } from '../api/client'
import { onboardingProgressQuery } from '../api/onboarding'
import { keys } from '../api/keys'
import type { Me } from '../api/me'
import { getPanel, type PanelTab } from '../api/panel'
import ErrorGenerico from '../components/ErrorGenerico'
import { AvisoCuerpo } from '../components/AvisoAmbar'
import SinConexion from '../components/SinConexion'
import { initialsOf } from '../shell/initials'
import { EMPTY_DETAIL, EMPTY_TITLE, PINNED_CATALOG_OUT_OF_DATE } from './inicioMessages'
import { inicioNotices } from './inicioNotices'
import InicioPanel from './inicio/InicioPanel'
import OnboardingNotice from './onboarding/OnboardingNotice'

export { EMPTY_DETAIL, EMPTY_TITLE, PINNED_CATALOG_OUT_OF_DATE }

interface VarietySummary {
  current_price: unknown
}

interface PinnedCatalogStatus {
  status: { state: 'up_to_date' | 'out_of_date' } | null
}

export default function Inicio() {
  const me = useOutletContext<Me>()
  const [tab, setTab] = useState<PanelTab>('today')

  const varietiesQuery = useQuery({
    queryKey: keys.varieties(),
    queryFn: () => get<VarietySummary[]>('/varieties'),
  })
  const hasPricedVariety = (varietiesQuery.data ?? []).some(
    (variety) => variety.current_price !== null,
  )

  const panelQuery = useQuery({
    queryKey: keys.panel(),
    queryFn: getPanel,
    gcTime: 0,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })

  const pinnedCatalog = useQuery({
    queryKey: keys.pinnedCatalogStatus(),
    queryFn: () => get<PinnedCatalogStatus>('/pinned-catalog/status'),
  })
  const pinOutOfDate = pinnedCatalog.data?.status?.state === 'out_of_date'

  const onboardingQuery = useQuery(onboardingProgressQuery)
  const notices = inicioNotices({
    onboarding: panelQuery.data === undefined ? undefined : onboardingQuery.data,
    pricedToday: varietiesQuery.data === undefined ? undefined : hasPricedVariety,
    pinOutOfDate,
  })
  const failed = [panelQuery, onboardingQuery].find((query) => query.isError)

  return (
    <main className="pantalla">
      <div className="cuerpo">
        <div className="inicio__cabecera">
          <div className="inicio__cabecera-titulos">
            <span className="encabezado__negocio">{me.business_name}</span>
            <span className="encabezado__titulo">Inicio</span>
          </div>
          <InAppLink
            to={SETTINGS}
            aria-label={`Configuración de ${me.business_name}`}
            className="inicio__avatar"
          >
            {initialsOf(me.business_name)}
          </InAppLink>
        </div>

        {notices.first?.kind === 'onboarding' && <OnboardingNotice progress={notices.first.progress} />}
        {notices.first?.kind === 'start' && (
          <div className="estado-vacio estado-vacio--atencion">
            <AvisoCuerpo attention>
              <span className="estado-vacio__titulo">{EMPTY_TITLE}</span>
              <span className="estado-vacio__detalle">{EMPTY_DETAIL}</span>
            </AvisoCuerpo>
          </div>
        )}
        {notices.pinOutOfDate && (
          <InAppLink to={CATALOG} className="aviso-ambar aviso-ambar--atencion" role="status">
            <AvisoCuerpo attention>
              <span className="aviso-ambar__titulo">{PINNED_CATALOG_OUT_OF_DATE}</span>
            </AvisoCuerpo>
          </InAppLink>
        )}

        {failed !== undefined && failed.error instanceof NetworkError && <SinConexion />}
        {failed !== undefined && !(failed.error instanceof NetworkError) && <ErrorGenerico />}

        {panelQuery.data !== undefined && (
          <InicioPanel panel={panelQuery.data} tab={tab} onTab={setTab} today={me.today} />
        )}
      </div>
    </main>
  )
}
