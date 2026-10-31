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
 * Slot 1 is `GET /first-run`'s `kind` (`inicioNotices`, ADR-0046): the Onboarding notice, the
 * first-run checklist, "Arrancá por las variedades" or nothing, drawn above the panel
 * instead of replacing it (a business can have history and no price today, and its
 * figures are real). The front derives none of it: it stays empty until `/first-run` has
 * answered, so nothing flashes, and a failure of it draws no slot 1 and no error (the
 * figures still show). The after-import notice is slot 3, after the pin notice. The
 * panel's and the Onboarding's failures show the existing "Sin conexión" or the retry.
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
import InAppLink from '../components/InAppLink'
import { owedPlace, useReturnToPlace } from '../components/useReturnToPlace'
import { get, NetworkError } from '../api/client'
import { firstRunQuery } from '../api/firstRun'
import { onboardingProgressQuery } from '../api/onboarding'
import { keys } from '../api/keys'
import type { Me } from '../api/me'
import { panelQuery, type PanelTab } from '../api/panel'
import ErrorGenerico from '../components/ErrorGenerico'
import Loading from '../components/Loading'
import { AvisoCuerpo } from '../components/AvisoAmbar'
import SinConexion from '../components/SinConexion'
import { initialsOf } from '../format/initials'
import { PINNED_CATALOG_OUT_OF_DATE } from '../copy/inicio'
import { useTranslation } from 'react-i18next'
import { EMPTY_STATE_KEYS } from '../copy/emptyStates'
import { inicioNotices } from './inicioNotices'
import FirstRunChecklist from './inicio/FirstRunChecklist'
import ImportNotice from './inicio/ImportNotice'
import InicioPanel from './inicio/InicioPanel'
import OnboardingNotice from './onboarding/OnboardingNotice'
import { COMMON_TEXT } from '../copy/common'

export { PINNED_CATALOG_OUT_OF_DATE }

interface PinnedCatalogStatus {
  status: { state: 'up_to_date' | 'out_of_date' } | null
}

export default function Inicio() {
  const { t } = useTranslation()
  const me = useOutletContext<Me>()
  const [tab, setTab] = useState<PanelTab>('today')

  const panelRead = useQuery(panelQuery)

  const pinnedCatalog = useQuery({
    queryKey: keys.pinnedCatalogStatus(),
    queryFn: () => get<PinnedCatalogStatus>('/pinned-catalog/status'),
  })
  const pinOutOfDate = pinnedCatalog.data?.status?.state === 'out_of_date'

  const onboardingQuery = useQuery(onboardingProgressQuery)
  const firstRun = useQuery(firstRunQuery)
  const notices = inicioNotices({
    firstRun: firstRun.data,
    onboarding: onboardingQuery.data,
    pinOutOfDate,
  })
  const root = useRef<HTMLElement>(null)
  // The notices above the panel make the page taller once they answer (pending, not failed: a
  // failure draws none), so the place is applied after them, never against a shorter page.
  const settled = !pinnedCatalog.isPending && !onboardingQuery.isPending && !firstRun.isPending
  useReturnToPlace({
    root,
    ready: panelRead.data !== undefined && !panelRead.isFetching && settled,
    fallback: owedPlace,
  })
  const failed = [panelRead, onboardingQuery].find((query) => query.isError)

  return (
    <main className="pantalla" ref={root}>
      <div className="cuerpo">
        <div className="inicio__cabecera">
          <div className="inicio__cabecera-titulos">
            <span className="encabezado__negocio">{me.business_name}</span>
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

        {notices.first?.kind === 'onboarding' && <OnboardingNotice progress={notices.first.progress} />}
        {notices.first?.kind === 'checklist' && <FirstRunChecklist steps={notices.first.steps} />}
        {notices.first?.kind === 'start' && (
          <div className="estado-vacio estado-vacio--atencion">
            <AvisoCuerpo attention>
              <span className="estado-vacio__titulo">{t(EMPTY_STATE_KEYS.homeVarietiesTitle)}</span>
              <span className="estado-vacio__detalle">{t(EMPTY_STATE_KEYS.homeVarietiesDetail)}</span>
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

        {notices.importNotice && <ImportNotice />}

        {failed !== undefined && failed.error instanceof NetworkError && <SinConexion />}
        {failed !== undefined && !(failed.error instanceof NetworkError) && <ErrorGenerico />}

        {/* A payment drops the cached panel, so Home can be empty while it reads again, and the
            notices above it make the page taller once they answer: the marker tells the scroll
            owner (`ScrollSync`) the page is not at its final height yet. */}
        {(panelRead.isPending || !settled) && failed === undefined && <Loading />}
        {panelRead.data !== undefined && (
          <InicioPanel panel={panelRead.data} tab={tab} onTab={setTab} today={me.today} />
        )}
      </div>
    </main>
  )
}
