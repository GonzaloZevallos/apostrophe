/**
 * `Archivadas` (`/varieties/archived`; `varieties.md`, "Archivadas"): a card (the shell draws its
 * "‹ Variedades") and no "+ Nueva venta", listing the archived varieties by name
 * (`Archivadas.dc.html`, `ArchivadasCompu.dc.html`). Each row is marked "Archivada" (the neutral
 * Insignia) and "Oculta" when the variety is hidden, and has "Restaurar", one tap with no
 * confirmation. A row opens the variety's own page, read-only. With none, a fixed line says so,
 * except when the seller walked in by a link of the app: then there is nothing to show and the
 * card goes on to Variedades (a restore of the last one pops back here; ADR-0032 amendment).
 *
 * Nothing here decides anything: the list is `GET /varieties?archived=true`, by name, and
 * whether a row is hidden is the stored `shown` of `GET /catalog/archived`.
 */

import { useQuery } from '@tanstack/react-query'
import { Navigate, useLocation } from 'react-router'

import { archivedCatalogQueryOptions } from '../../api/catalog'
import Boton from '../../components/Boton'
import { NetworkError } from '../../api/client'
import ErrorGenerico from '../../components/ErrorGenerico'
import Insignia from '../../components/Insignia'
import Loading from '../../components/Loading'
import PaneRowLink from '../../components/PaneRowLink'
import SinConexion from '../../components/SinConexion'
import { FOLLOWED_REDIRECT } from '../../flash/flashReducer'
import { VARIETIES, VARIETY, pathTo } from '../../routes'
import { useViewport } from '../../shell/useViewport'
import { archivedVarietiesQueryOptions } from './archivedVarieties'
import { useRestore } from './useRestore'
import { ARCHIVED, HIDDEN, NO_ARCHIVED_MESSAGE, RESTORE } from '../../copy/varieties'
import { varietiesByName } from './varietiesByName'

const ACTIVE_ROW_CLASS = 'variedad-fila variedad-fila--activa'

/** Whether this entry was opened by a link of the app (`inAppState`), not typed or reloaded. */
function isInApp(state: unknown): boolean {
  return typeof state === 'object' && state !== null && 'inApp' in state && state.inApp === true
}

export default function ArchivedVarieties() {
  const computer = useViewport() === 'computer'
  const query = useQuery(archivedVarietiesQueryOptions())
  const catalog = useQuery(archivedCatalogQueryOptions())
  const { restore, sending, notice } = useRestore()
  const { state } = useLocation()
  const failure = query.error ?? catalog.error
  const loaded = query.data !== undefined && catalog.data !== undefined
  const hidden = new Set(catalog.data?.filter((attributes) => !attributes.shown).map((attributes) => attributes.variety_id))

  if (query.data?.length === 0 && catalog.data !== undefined && isInApp(state)) {
    return <Navigate to={VARIETIES} replace state={FOLLOWED_REDIRECT} />
  }

  return (
    <main className="pantalla variedades">
      <div className="cuerpo">
        <h1 className="encabezado__titulo">{ARCHIVED}</h1>
        {notice}
        {failure !== null && (failure instanceof NetworkError ? <SinConexion /> : <ErrorGenerico />)}
        {failure === null && !loaded && <Loading />}
        {loaded && query.data.length === 0 && (
          <div className="estado-vacio">
            <span className="estado-vacio__titulo" data-copy="emptyTitle">{NO_ARCHIVED_MESSAGE}</span>
          </div>
        )}
        {loaded && query.data.length > 0 && (
          <div className="lista-variedades">
            {varietiesByName(query.data).map((variety) => (
              <div key={variety.id} className="variedad-archivada">
                <PaneRowLink
                  to={pathTo(VARIETY, { id: variety.id })}
                  replace={computer}
                  className="variedad-fila"
                  activeClassName={ACTIVE_ROW_CLASS}
                >
                  <span className="variedad-fila__nombre">{variety.name}</span>
                  <span className="variedad-marcas">
                    <Insignia>{ARCHIVED}</Insignia>
                    {hidden.has(variety.id) && <span className="variedad-resumen__oculta">{HIDDEN}</span>}
                  </span>
                </PaneRowLink>
                <Boton variant="secondary" icon="restaurar" disabled={sending} onClick={() => void restore(variety.id)}>
                  {RESTORE}
                </Boton>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
