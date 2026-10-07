/**
 * `EntradaStock` (`stock.md`, "On screen"): records a new stock entry or edits one,
 * shared by `/varieties/entries/new` and `/varieties/entries/:id`, the way
 * `ClienteForm` shares add and edit. It is a form ("Cerrar", no bar): Cerrar and a save go
 * back by history, or with none to Variedades (new) / "Todas las entradas" (edit), and leaving
 * with something typed asks first. `?variety={id}` chooses that variety, and "Stock inicial"
 * with it when `entriesOf` finds none for it. Editing confirms before saving; deleting confirms
 * through `ConfirmDialog`, naming the date, variety and grams (`stock.md`: "Antes de
 * borrar"). The form itself (fields, refusals, the cost-per-gram preview, the confirmations)
 * is `StockEntryForm`; this screen keeps the chrome, the leave guard and the navigation.
 */

import { useCallback, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useBlocker, useOutletContext, useParams, useSearchParams } from 'react-router'
import { ApiError, NetworkError } from '../api/client'
import { keys } from '../api/keys'
import type { Me } from '../api/me'
import { isGone } from '../api/refusals'
import { type StockEntry, entriesOf, getEntry, readStock } from '../api/stock'
import ConfirmDialog from '../components/ConfirmDialog'
import ErrorGenerico from '../components/ErrorGenerico'
import GoneScreen from '../components/GoneScreen'
import SinConexion from '../components/SinConexion'
import Loading from '../components/Loading'
import { useHistoryBack } from '../components/useHistoryBack'
import { useFlash } from '../flash/useFlash'
import { ENTRIES, VARIETIES } from '../routes'
import StockEntryForm from './StockEntryForm'

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
      return <GoneScreen label="Variedades" to={VARIETIES} />
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
  const back = useHistoryBack(mode === 'nuevo' ? VARIETIES : ENTRIES)
  const flash = useFlash()
  const leftRef = useRef(false)
  const dirtyRef = useRef(false)
  const blocker = useBlocker(() => dirtyRef.current && !leftRef.current)
  const [gone, setGone] = useState(false)
  // The form's dialogs sit after the body, as the screen always drew them.
  const [dialogHost, setDialogHost] = useState<HTMLElement | null>(null)

  const onDirtyChange = useCallback((dirty: boolean) => {
    dirtyRef.current = dirty
  }, [])

  function leave(toast: 'Entrada guardada' | 'Entrada eliminada'): void {
    leftRef.current = true
    flash.armAfterLeaving(toast)
    back()
  }

  if (gone) return <GoneScreen label="Variedades" to={VARIETIES} />

  return (
    <main className="pantalla">
      <div className="cuerpo">
        <div className="gasto-form__cabecera">
          <span className="gasto-form__titulo">
            {mode === 'nuevo' ? 'Nueva entrada' : 'Editar entrada'}
          </span>
          <button type="button" className="boton--enlace gasto-form__cerrar" onClick={back}>
            Cerrar
          </button>
        </div>
        <StockEntryForm
          mode={mode}
          today={today}
          entryId={entryId}
          initial={initial}
          preselectedVarietyId={chosenVariety}
          preselectedOrigin={chosenVariety !== undefined && hasEntries === false ? 'opening_stock' : undefined}
          onSaved={() => leave('Entrada guardada')}
          onDeleted={() => leave('Entrada eliminada')}
          onGone={() => setGone(true)}
          onDirtyChange={onDirtyChange}
          dialogHost={dialogHost}
        />
      </div>
      <div ref={setDialogHost} className="sin-caja" />
      {blocker.state === 'blocked' && (
        <ConfirmDialog
          title={mode === 'nuevo' ? '¿Descartás la entrada?' : '¿Descartás los cambios?'}
          detail="Se pierde lo que cargaste: todavía no se guardó nada."
          confirmText="Sí, descartalo"
          cancelText="No, seguí cargando"
          onConfirm={() => blocker.proceed()}
          onCancel={() => blocker.reset()}
        />
      )}
    </main>
  )
}
