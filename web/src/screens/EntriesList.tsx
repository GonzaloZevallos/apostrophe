/**
 * `EntriesList` (`stock.md`, "All entries"; `TodasLasEntradas.dc.html`): every stock
 * entry, newest first, and no withdrawal; or with a `varietyId` that variety's movements as
 * `GET /stock/varieties/{id}/movements` answers them: its entries and the withdrawals that
 * touch it, a withdrawal told by its reason word and a minus sign and opening its detail. It is a card; the shell draws its one back ("‹ Varieties",
 * or "‹ <variety>" for one variety's list, declared through `useBackParent`). Each row
 * links to the entry's form to edit it and deletes it after "Before deleting", naming the
 * date, variety and grams. Every figure is what `GET /stock` answered; a variety's name
 * comes from `GET /varieties`, joined by id. One archived variety's list is read-only: its
 * entry rows have no edit or delete and open nothing (they stay editable and deletable from
 * "All entries"); its withdrawal rows still open the withdrawal's detail.
 */

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useOutletContext } from 'react-router'
import { ApiError, NetworkError, get } from '../api/client'
import { invalidateResource, keys } from '../api/keys'
import type { Me } from '../api/me'
import { isGone } from '../api/refusals'
import { type Movement, type StockEntry, deleteEntry, readMovements, readStock } from '../api/stock'
import ConfirmDialog from '../components/ConfirmDialog'
import ErrorGenerico, { ERROR_GENERICO_MENSAJE } from '../components/ErrorGenerico'
import GoneNotice from '../components/GoneNotice'
import { useGoneNotice } from '../components/goneExit'
import GoneScreen from '../components/GoneScreen'
import InAppLink from '../components/InAppLink'
import Loading from '../components/Loading'
import SinConexion from '../components/SinConexion'
import Boton from '../components/Boton'
import BotonLink from '../components/BotonLink'
import { useFlash } from '../flash/useFlash'
import { formatDate } from '../format/dates'
import { formatGrams, formatMoney } from '../format/money'
import { STOCK_ENTRY, VARIETIES, WITHDRAWAL, pathTo } from '../routes'
import { useBackParent } from '../shell/useBackParent'
import type { Variety } from './Variedades'
import { ORIGIN_LABEL } from './originLabel'
import {
  ALL_ENTRIES_TITLE,
  BEFORE_DELETING,
  DELETE,
  EDIT,
  EMPTY_STATE_DETAIL,
  EMPTY_STATE_TITLE,
  ENTRIES_TITLE,
  NO_COST,
  NO_KEEP_IT,
  YES_DELETE_IT,
  costPerGramLine,
  deleteEntryQuestion,
} from '../copy/stock'
import { ENTRY_DELETED } from '../copy/common'
import { TAB_VARIETIES } from '../copy/shell'
import { REASON_LABEL } from './withdrawals/withdrawalReasons'

/** Row keys of the merged movement list: an identity, never a word. */
const WITHDRAWAL_KEY_PREFIX = 'withdrawal-'
const ENTRY_KEY_PREFIX = 'entry-'


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

  useBackParent('variety-entries' as const, varietyQuery.data === undefined ? undefined : { title: varietyQuery.data.name })

  const [confirming, setConfirming] = useState<StockEntry | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [offline, setOffline] = useState(false)
  const [failed, setFailed] = useState(false)
  const [goneNotice, setGoneNotice] = useState(false)
  const goneExited = useGoneNotice()

  const error = stockQuery.error ?? varietyQuery.error ?? movementsQuery.error
  if (varietyQuery.error instanceof ApiError && isGone(varietyQuery.error.code)) {
    return <GoneScreen label={TAB_VARIETIES} to={VARIETIES} />
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
  const readOnly = varietyQuery.data?.archived === true
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
      flash.showNow(ENTRY_DELETED)
    } catch (caught) {
      if (caught instanceof ApiError && isGone(caught.code)) setGoneNotice(true)
      else if (caught instanceof NetworkError) setOffline(true)
      else setFailed(true)
    } finally {
      setConfirming(null)
      setDeleting(false)
    }
    invalidateResource(queryClient, 'stock' as const)
  }

  return (
    <Card>
      <h1 className="encabezado__titulo">
        {varietyId === undefined ? ALL_ENTRIES_TITLE : ENTRIES_TITLE}
      </h1>
      {(goneNotice || goneExited) && <GoneNotice />}
      {offline && <SinConexion />}
      {failed && <span className="campo__error" role="alert">{ERROR_GENERICO_MENSAJE}</span>}

      {rows.length === 0 ? (
        <div className="estado-vacio">
          <span className="estado-vacio__titulo" data-copy="emptyTitle">{EMPTY_STATE_TITLE}</span>
          <span className="estado-vacio__detalle" data-copy="emptyLine">{EMPTY_STATE_DETAIL}</span>
        </div>
      ) : (
        <ul className="lista-entradas">
          {rows.map((entry) =>
            entry.kind === 'withdrawal' ? (
              <li key={`${WITHDRAWAL_KEY_PREFIX}${entry.id}`} className="fila-entrada">
                <InAppLink to={pathTo(WITHDRAWAL, { id: entry.id })} className="fila-entrada__enlace">
                  <span className="fila-entrada__texto">
                    <span className="fila-entrada__linea1">
                      {formatDate(entry.date, me.today)} · {nameOf(varietyId ?? 0)}
                    </span>
                    <span className="fila-entrada__linea2">
                      {REASON_LABEL[entry.reason]} · {`−${formatGrams(entry.grams)}`}
                    </span>
                  </span>
                </InAppLink>
              </li>
            ) : (
              <li key={`${ENTRY_KEY_PREFIX}${entry.id}`} className="fila-entrada">
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
                    <span className="fila-entrada__costo fila-entrada__costo--sin">{NO_COST}</span>
                  ) : (
                    <>
                      <span className="fila-entrada__costo">{formatMoney(entry.total_cost)}</span>
                      {entry.cost_per_gram !== null && (
                        <span className="fila-entrada__linea2">
                          {costPerGramLine(formatMoney(entry.cost_per_gram))}
                        </span>
                      )}
                    </>
                  )}
                </span>
                {!readOnly && (
                  <span className="fila-entrada__acciones">
                    <BotonLink variant="icon" action="edit" ariaLabel={EDIT} to={pathTo(STOCK_ENTRY, { id: entry.id })} />
                    <Boton
                      variant="icon"
                      action="delete"
                      ariaLabel={DELETE}
                      onClick={() => setConfirming(entry)}
                    />
                  </span>
                )}
              </li>
            ),
          )}
        </ul>
      )}

      {confirming !== null && (
        <ConfirmDialog
          title={BEFORE_DELETING}
          detail={deleteEntryQuestion(
            formatDate(confirming.date, me.today),
            nameOf(confirming.variety_id),
            formatGrams(confirming.grams),
          )}
          confirmText={YES_DELETE_IT}
          cancelText={NO_KEEP_IT}
          onConfirm={() => {
            if (!deleting) void onConfirmDelete(confirming)
          }}
          onCancel={() => setConfirming(null)}
        />
      )}
    </Card>
  )
}
