/**
 * `EntriesList` (`stock.md`, "Todas las entradas"; `TodasLasEntradas.dc.html`): every stock
 * entry, newest first, and no withdrawal; or with a `varietyId` that variety's movements as
 * `GET /stock/varieties/{id}/movements` answers them: its entries and the withdrawals that
 * touch it, a withdrawal told by its reason word and a minus sign and opening its detail. It is a card: "‹ Variedades" (or "‹ <variety>" for one
 * variety's list) goes back by history, and with none to the list it came from. Each row
 * links to the entry's form to edit it and deletes it after "Antes de borrar", naming the
 * date, variety and grams. Every figure is what `GET /stock` answered; a variety's name
 * comes from `GET /varieties`, joined by id.
 */

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useOutletContext } from 'react-router'
import { ApiError, NetworkError, get } from '../api/client'
import { invalidateResource, keys } from '../api/keys'
import type { Me } from '../api/me'
import { isGone } from '../api/refusals'
import { type Movement, type StockEntry, deleteEntry, readMovements, readStock } from '../api/stock'
import ConfirmDialog from '../components/ConfirmDialog'
import ErrorGenerico, { ERROR_GENERICO_MENSAJE } from '../components/ErrorGenerico'
import GoneNotice from '../components/GoneNotice'
import GoneScreen from '../components/GoneScreen'
import Loading from '../components/Loading'
import SinConexion from '../components/SinConexion'
import { useHistoryBack } from '../components/useHistoryBack'
import { useFlash } from '../flash/useFlash'
import { formatDate } from '../format/dates'
import { formatGrams, formatMoney } from '../format/money'
import { ENTRY, VARIETIES, VARIETY, withdrawalPath } from '../routes'
import type { Variety } from './Variedades'
import { ORIGIN_LABEL } from './originLabel'
import { REASON_LABEL } from './withdrawals/withdrawalReasons'

export const EMPTY_STATE_TITLE = 'Sin entradas de stock'
export const EMPTY_STATE_DETAIL = 'Cargá tu stock inicial o una compra'

function Card({ children }: { children: React.ReactNode }) {
  return (
    <main className="pantalla">
      <div className="cuerpo">{children}</div>
    </main>
  )
}

interface Props {
  varietyId?: number
}

export default function EntriesList({ varietyId }: Props) {
  const me = useOutletContext<Me>()
  const queryClient = useQueryClient()
  const flash = useFlash()
  const back = useHistoryBack(varietyId === undefined ? VARIETIES : VARIETY(varietyId))

  const stockQuery = useQuery({ queryKey: keys.stock(), queryFn: readStock })
  const varietiesQuery = useQuery({
    queryKey: keys.varieties(),
    queryFn: () => get<Variety[]>('/varieties'),
  })
  const varietyQuery = useQuery({
    queryKey: keys.variety(String(varietyId)),
    queryFn: () => get<Variety>(`/varieties/${varietyId}`),
    enabled: varietyId !== undefined,
  })
  const movementsQuery = useQuery({
    queryKey: keys.stockMovements(String(varietyId)),
    queryFn: () => readMovements(String(varietyId)),
    enabled: varietyId !== undefined,
  })

  const [confirming, setConfirming] = useState<StockEntry | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [offline, setOffline] = useState(false)
  const [failed, setFailed] = useState(false)
  const [goneNotice, setGoneNotice] = useState(false)

  const error = stockQuery.error ?? varietyQuery.error ?? movementsQuery.error
  if (varietyQuery.error instanceof ApiError && isGone(varietyQuery.error.code)) {
    return <GoneScreen label="Variedades" to={VARIETIES} />
  }
  if (error !== null) {
    return <Card>{error instanceof NetworkError ? <SinConexion /> : <ErrorGenerico />}</Card>
  }
  if (
    stockQuery.data === undefined ||
    (varietyId !== undefined && (varietyQuery.data === undefined || movementsQuery.data === undefined))
  ) {
    return (
      <Card>
        <Loading />
      </Card>
    )
  }

  const stock = stockQuery.data
  const rows: Movement[] =
    varietyId === undefined || movementsQuery.data === undefined
      ? stock.entries.map((entry) => ({ ...entry, kind: 'entry' as const }))
      : movementsQuery.data
  const nameOf = (id: number): string =>
    (varietiesQuery.data ?? []).find((variety) => variety.id === id)?.name ?? ''

  async function onConfirmDelete(entry: StockEntry): Promise<void> {
    setDeleting(true)
    setOffline(false)
    setFailed(false)
    try {
      await deleteEntry(String(entry.id))
      flash.showNow('Entrada eliminada')
    } catch (caught) {
      if (caught instanceof ApiError && isGone(caught.code)) setGoneNotice(true)
      else if (caught instanceof NetworkError) setOffline(true)
      else setFailed(true)
    } finally {
      setConfirming(null)
      setDeleting(false)
    }
    invalidateResource(queryClient, 'stock')
  }

  return (
    <Card>
      <button type="button" className="boton--enlace fila-entrada__volver" onClick={back}>
        {varietyId === undefined ? '‹ Variedades' : `‹ ${varietyQuery.data?.name ?? ''}`}
      </button>
      <h1 className="encabezado__titulo">
        {varietyId === undefined ? 'Todas las entradas' : 'Entradas'}
      </h1>
      {goneNotice && <GoneNotice />}
      {offline && <SinConexion />}
      {failed && <span className="campo__error" role="alert">{ERROR_GENERICO_MENSAJE}</span>}

      {rows.length === 0 ? (
        <div className="estado-vacio">
          <span className="estado-vacio__titulo">{EMPTY_STATE_TITLE}</span>
          <span className="estado-vacio__detalle">{EMPTY_STATE_DETAIL}</span>
        </div>
      ) : (
        <ul className="lista-entradas">
          {rows.map((entry) =>
            entry.kind === 'withdrawal' ? (
              <li key={`withdrawal-${entry.id}`} className="fila-entrada">
                <Link to={withdrawalPath(entry.id)} className="fila-entrada__enlace">
                  <span className="fila-entrada__texto">
                    <span className="fila-entrada__linea1">
                      {formatDate(entry.date, me.today)} · {nameOf(varietyId ?? 0)}
                    </span>
                    <span className="fila-entrada__linea2">
                      {REASON_LABEL[entry.reason]} · {`−${formatGrams(entry.grams)}`}
                    </span>
                  </span>
                </Link>
              </li>
            ) : (
              <li key={`entry-${entry.id}`} className="fila-entrada">
                <span className="fila-entrada__texto">
                  <span className="fila-entrada__linea1">
                    {formatDate(entry.date, me.today)} · {nameOf(entry.variety_id)}
                  </span>
                  <span className="fila-entrada__linea2">
                    {ORIGIN_LABEL[entry.origin]} · {formatGrams(entry.grams)}
                  </span>
                </span>
                <span className="fila-entrada__cifras">
                  {entry.total_cost === null ? (
                    <span className="fila-entrada__costo fila-entrada__costo--sin">Sin costo</span>
                  ) : (
                    <>
                      <span className="fila-entrada__costo">{formatMoney(entry.total_cost)}</span>
                      {entry.cost_per_gram !== null && (
                        <span className="fila-entrada__linea2">
                          {formatMoney(entry.cost_per_gram)} x g
                        </span>
                      )}
                    </>
                  )}
                </span>
                <span className="fila-entrada__acciones">
                  <Link to={ENTRY(entry.id)}>Editar</Link>
                  <button type="button" className="boton--enlace" onClick={() => setConfirming(entry)}>
                    Borrar
                  </button>
                </span>
              </li>
            ),
          )}
        </ul>
      )}

      {confirming !== null && (
        <ConfirmDialog
          title="Antes de borrar"
          detail={`¿Borrás la entrada del ${formatDate(confirming.date, me.today)} de ${nameOf(confirming.variety_id)}, ${formatGrams(confirming.grams)}? Esto no se puede deshacer.`}
          confirmText="Sí, borrala"
          cancelText="No, dejala"
          onConfirm={() => {
            if (!deleting) void onConfirmDelete(confirming)
          }}
          onCancel={() => setConfirming(null)}
        />
      )}
    </Card>
  )
}
