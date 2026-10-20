/**
 * `EntradaStock` (`stock.md`, "On screen"): records a new stock entry or edits one,
 * shared by `/varieties/entries/new` and `/varieties/entries/:id`, the way
 * `ClienteForm` shares add and edit. It is a form ("Close", no bar): Close and a save go
 * back by history, or with none to Varieties (new) / "All entries" (edit), and leaving
 * with something typed asks first. `?variety={id}` chooses that variety, and "Opening stock"
 * with it when `entriesOf` finds none for it. Editing confirms before saving; deleting confirms
 * through `ConfirmDialog`, naming the date, variety and grams (`stock.md`: "Before
 * deleting"). The form itself (fields, refusals, the cost-per-gram preview, the confirmations)
 * is `StockEntryForm`; this screen keeps the chrome, the leave guard and the navigation.
 */

import { useCallback, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useOutletContext, useParams, useSearchParams } from 'react-router'
import { ApiError, NetworkError } from '../api/client'
import { keys } from '../api/keys'
import type { Me } from '../api/me'
import { isGone } from '../api/refusals'
import { type Origin, type StockEntry, entriesOf, getEntry, readStock } from '../api/stock'
import ConfirmDialog from '../components/ConfirmDialog'
import ErrorGenerico from '../components/ErrorGenerico'
import GoneScreen from '../components/GoneScreen'
import SinConexion from '../components/SinConexion'
import Loading from '../components/Loading'
import { useBackOr } from '../components/useBackOr'
import { useGoneExit } from '../components/useGoneExit'
import { useLeaveGuard } from '../components/useLeaveGuard'
import { useFlash } from '../flash/useFlash'
import { STOCK, VARIETIES } from '../routes'
import Boton from '../components/Boton'
import { CLOSE, ENTRY_DELETED, ENTRY_SAVED } from '../copy/common'
import { TAB_VARIETIES } from '../copy/shell'
import {
  DISCARD_CHANGES_TITLE,
  DISCARD_ENTRY_DETAIL,
  DISCARD_ENTRY_TITLE,
  EDIT_ENTRY_TITLE,
  NEW_ENTRY_TITLE,
  NO_KEEP_ENTERING,
  YES_DISCARD_IT,
} from '../copy/stock'
import StockEntryForm from './StockEntryForm'

const OPENING_STOCK_CODE: Origin = 'opening_stock'

interface Props {
  mode: 'nuevo' | 'editar'
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <main className="pantalla">
      <div className="cuerpo">{children}</div>
    </main>
  )
}

export default function EntradaStock({ mode }: Props) {
  const me = useOutletContext<Me>()
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const entryId = id ?? ''
  const fromVariety = parseVarietyParam(searchParams.get('variety'))

  const existing = useQuery({
    queryKey: keys.stockEntry(entryId),
    queryFn: () => getEntry(entryId),
    enabled: mode === 'editar',
  })
  // The preselection needs to know whether the variety has entries: the form waits for it.
  const stockQuery = useQuery({
    queryKey: keys.stock(),
    queryFn: readStock,
    enabled: mode === 'nuevo' && fromVariety !== null,
  })

  if (mode === 'nuevo') {
    if (fromVariety === null) return <EntradaStockBody mode="nuevo" entryId={entryId} today={me.today} />
    if (stockQuery.isError) return <Frame>{errorOf(stockQuery.error)}</Frame>
    if (stockQuery.data === undefined) {
      return (
        <Frame>
          <Loading />
        </Frame>
      )
    }
    return (
      <EntradaStockBody
        mode="nuevo"
        entryId={entryId}
        today={me.today}
        chosenVariety={fromVariety}
        hasEntries={entriesOf(stockQuery.data, fromVariety).length > 0}
      />
    )
  }

  if (existing.isError) {
    if (existing.error instanceof ApiError && isGone(existing.error.code)) {
      return <GoneScreen label={TAB_VARIETIES} to={VARIETIES} />
    }
    return <Frame>{errorOf(existing.error)}</Frame>
  }

  if (existing.data === undefined) {
    return (
      <Frame>
        <Loading />
      </Frame>
    )
  }

  return <EntradaStockBody mode="editar" entryId={entryId} today={me.today} initial={existing.data} />
}

function parseVarietyParam(raw: string | null): number | null {
  if (raw === null || !/^[0-9]+$/.test(raw)) return null
  const value = Number(raw)
  return Number.isSafeInteger(value) ? value : null
}

function errorOf(error: unknown) {
  return error instanceof NetworkError ? <SinConexion /> : <ErrorGenerico />
}

interface BodyProps {
  mode: 'nuevo' | 'editar'
  entryId: string
  today: string
  initial?: StockEntry
  chosenVariety?: number
  hasEntries?: boolean
}

function EntradaStockBody({ mode, entryId, today, initial, chosenVariety, hasEntries }: BodyProps) {
  const flash = useFlash()
  const back = useBackOr(mode === 'nuevo' ? VARIETIES : STOCK)
  const goneExit = useGoneExit('stock-entry' as const, { id: entryId })
  const [dirty, setDirty] = useState(false)
  const { blocker, disarm } = useLeaveGuard(dirty)
  // The form's dialogs sit after the body, as the screen always drew them.
  const [dialogHost, setDialogHost] = useState<HTMLElement | null>(null)

  const onDirtyChange = useCallback((next: boolean) => {
    setDirty(next)
  }, [])

  function leave(toast: typeof ENTRY_SAVED | typeof ENTRY_DELETED): void {
    disarm()
    flash.armAfterLeaving(toast)
    back()
  }

  // The entry is no longer there (deleted elsewhere, or never this business's): the form
  // already marked the stock stale.
  function entryIsGone(): void {
    disarm()
    goneExit()
  }

  return (
    <main className="pantalla">
      <div className="cuerpo">
        <div className="gasto-form__cabecera">
          <span className="gasto-form__titulo">
            {mode === 'nuevo' ? NEW_ENTRY_TITLE : EDIT_ENTRY_TITLE}
          </span>
          <span className="gasto-form__cerrar">
            <Boton variant="icon" action="close" ariaLabel={CLOSE} onClick={back} />
          </span>
        </div>
        <StockEntryForm
          mode={mode}
          today={today}
          entryId={entryId}
          initial={initial}
          preselectedVarietyId={chosenVariety}
          preselectedOrigin={chosenVariety !== undefined && hasEntries === false ? OPENING_STOCK_CODE : undefined}
          onSaved={() => leave(ENTRY_SAVED)}
          onDeleted={() => leave(ENTRY_DELETED)}
          onGone={entryIsGone}
          onDirtyChange={onDirtyChange}
          dialogHost={dialogHost}
        />
      </div>
      <div ref={setDialogHost} className="sin-caja" />
      {blocker.state === 'blocked' && (
        <ConfirmDialog
          title={mode === 'nuevo' ? DISCARD_ENTRY_TITLE : DISCARD_CHANGES_TITLE}
          detail={DISCARD_ENTRY_DETAIL}
          confirmText={YES_DISCARD_IT}
          cancelText={NO_KEEP_ENTERING}
          onConfirm={() => blocker.proceed()}
          onCancel={() => blocker.reset()}
        />
      )}
    </main>
  )
}
