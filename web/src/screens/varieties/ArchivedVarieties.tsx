/**
 * `Archivadas` (`/varieties/archived`; `varieties.md`, "Archivadas"; `Archivadas.dc.html`): a
 * card, "‹ Variedades" and no "+ Nueva venta", listing the archived varieties by name. Each
 * row shows the name, the neutral "Archivada" Insignia, "Oculta" when its stored values say
 * hidden and its grams as a plain figure (at zero and below too), and has "Restaurar", one
 * tap with no confirmation. A row opens the variety's own page, read-only. With none, a fixed
 * title and line say so, with the way back to Variedades.
 *
 * Nothing here decides anything: the list is `GET /varieties?archived=true`, by name, the grams
 * are `GET /stock?archived=true` and the hidden flag is `GET /catalog/varieties/{id}`.
 *
 * Restaurar keeps the seller here. On a computer, when the restored variety is the one open
 * on the right, the selection moves with `replace` to the next archived variety by name, else
 * the previous one, else this card's empty state, never to a variety restored since this card
 * opened (the list may still be the one from before those restores).
 */

import { useEffect } from 'react'
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useMatch, useNavigate } from 'react-router'

import { NetworkError } from '../../api/client'
import { varietyAttributesQueryOptions } from '../../api/catalog'
import { keys } from '../../api/keys'
import { readArchivedStock } from '../../api/stock'
import Boton from '../../components/Boton'
import BotonLink from '../../components/BotonLink'
import ErrorGenerico from '../../components/ErrorGenerico'
import Insignia from '../../components/Insignia'
import Loading from '../../components/Loading'
import SinConexion from '../../components/SinConexion'
import { formatGrams } from '../../format/money'
import { ARCHIVED_VARIETIES, VARIETIES, VARIETY, pathTo } from '../../routes'
import { useViewport } from '../../shell/useViewport'
import type { Variety } from '../Variedades'
import { archivedVarietiesQueryOptions } from './archivedVarieties'
import { useRestore } from './useRestore'
import { NO_ARCHIVED_LINE, NO_ARCHIVED_MESSAGE } from './varietiesMessages'
import VarietyRowLink from './VarietyRowLink'
import { varietiesByName } from './varietiesByName'

/** The ids restored from this card, per client. The card on the left is redrawn when the pane
 * changes (a computer's selection moving from one archived variety to the next), so the set
 * cannot live in the component. An id leaves it once a finished read of the list lacks it. */
const restoredBy = new WeakMap<QueryClient, Set<number>>()

function restoredIdsOf(queryClient: QueryClient): Set<number> {
  const known = restoredBy.get(queryClient)
  if (known !== undefined) return known
  const created = new Set<number>()
  restoredBy.set(queryClient, created)
  return created
}

/** Where the selection goes once `restoredId` leaves the list: the next archived variety by
 * name, else the previous one, else the card itself. `restored` holds every id restored since
 * the card opened, `restoredId` among them; the list may still carry all of them. */
function selectionAfter(list: readonly Variety[], restored: ReadonlySet<number>, restoredId: number): string {
  const ordered = varietiesByName(list)
  const at = ordered.findIndex((variety) => variety.id === restoredId)
  const stays = (variety: Variety) => !restored.has(variety.id)
  const next = ordered.slice(at + 1).find(stays)
  const previous = ordered.slice(0, Math.max(at, 0)).reverse().find(stays)
  const target = next ?? previous
  return target === undefined ? ARCHIVED_VARIETIES : pathTo(VARIETY, { id: target.id })
}

function ArchivedRow({
  variety,
  grams,
  computer,
  sending,
  onRestore,
}: {
  variety: Variety
  grams: number | undefined
  computer: boolean
  sending: boolean
  onRestore: () => void
}) {
  // One primary-key read per row: the list is small, and the flag is the stored value.
  const { data: attributes } = useQuery(varietyAttributesQueryOptions(String(variety.id)))
  return (
    <div className="variedad-archivada">
      <VarietyRowLink to={pathTo(VARIETY, { id: variety.id })} replace={computer}>
        <span className="variedad-fila__encabezado">
          <span className="variedad-fila__nombre">{variety.name}</span>
        </span>
        <span className="variedad-fila__estado">
          <Insignia>Archivada</Insignia>
          {attributes !== undefined && !attributes.shown && <span className="variedad-fila__oculta">Oculta</span>}
          {grams !== undefined && <span>{formatGrams(grams)}</span>}
        </span>
      </VarietyRowLink>
      <Boton variant="secondary" icon="restaurar" disabled={sending} onClick={onRestore}>
        Restaurar
      </Boton>
    </div>
  )
}

export default function ArchivedVarieties() {
  const computer = useViewport() === 'computer'
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const selected = useMatch(VARIETY)?.params.id
  const query = useQuery(archivedVarietiesQueryOptions())
  const stockQuery = useQuery({ queryKey: keys.archivedStock(), queryFn: readArchivedStock })
  const restoredIds = restoredIdsOf(queryClient)
  useEffect(() => {
    // Only a list the server answered says an id is gone, never the one pruned here.
    if (query.data === undefined || query.isFetching) return
    const listed = new Set(query.data.map((variety) => variety.id))
    for (const id of restoredIds) if (!listed.has(id)) restoredIds.delete(id)
  }, [query.data, query.isFetching, restoredIds])
  const { restore, sending, notice } = useRestore((restoredId) => {
    restoredIds.add(restoredId)
    if (!computer || selected !== String(restoredId)) return
    const list = queryClient.getQueryData(archivedVarietiesQueryOptions().queryKey) ?? []
    const target = selectionAfter(list, restoredIds, restoredId)
    // The left pane must not read the list as it was, with this variety still in it.
    queryClient.setQueryData(
      archivedVarietiesQueryOptions().queryKey,
      list.filter((variety) => !restoredIds.has(variety.id)),
    )
    void navigate(target, { replace: true })
  })
  const failure = query.error
  const gramsOf = (id: number) => stockQuery.data?.varieties.find((row) => row.variety_id === id)?.grams

  return (
    <main className="pantalla variedades">
      <div className="cuerpo">
        <div className="encabezado__fila">
          <BotonLink to={VARIETIES} variant="back">
            ‹ Variedades
          </BotonLink>
        </div>
        <h1 className="encabezado__titulo">Archivadas</h1>
        {notice}
        {failure !== null && (failure instanceof NetworkError ? <SinConexion /> : <ErrorGenerico />)}
        {failure === null && query.data === undefined && <Loading />}
        {query.data !== undefined && query.data.length === 0 && (
          <div className="estado-vacio">
            <span className="estado-vacio__titulo" data-copy="emptyTitle">{NO_ARCHIVED_MESSAGE}</span>
            <span className="estado-vacio__detalle" data-copy="emptyLine">{NO_ARCHIVED_LINE}</span>
            <BotonLink variant="primary" icon="atras" to={VARIETIES}>
              Volver a Variedades
            </BotonLink>
          </div>
        )}
        {query.data !== undefined && query.data.length > 0 && (
          <div className="lista-variedades">
            {varietiesByName(query.data).map((variety) => (
              <ArchivedRow
                key={variety.id}
                variety={variety}
                grams={gramsOf(variety.id)}
                computer={computer}
                sending={sending}
                onRestore={() => void restore(variety.id)}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
