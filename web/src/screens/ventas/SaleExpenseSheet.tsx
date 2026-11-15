/**
 * The Expense row of phone New sale and the host of the expense Sheet over it (`expenses.md`,
 * "From New sale"; ADR-0078 and the ADR that extends it). Phone only: the sale stays mounted under
 * the Sheet, which is a history entry (`useSheet(1)`) New sale mirrors in `expenseOpen`.
 *
 * - `ExpenseRow`: "Other things to record" with one tile, "Expense", always offered.
 * - `SaleExpenseSheet` (the host, mounted while `expenseOpen`): pushes its entry, and when that
 *   entry pops after it was seen open, calls `onClosed` (New sale clears `expenseOpen`). When the
 *   layout turns computer it pops the entry (marked `switching`) and calls `onClosed`: what was
 *   typed in the expense is lost, the sale is kept. Close, the strip's Back and the system back
 *   are all `sheet.close()`; the host never disarms a guard and never clears `expenseOpen` itself.
 * - The form is drawn under `SheetLevel` 1, so its own Selector lists open at level 2.
 * - A save refreshes the expenses, arms the toast ("Expense recorded" while a sale is in progress,
 *   else the form's "Expense saved") and asks New sale to close the Sheet (`onSaved`).
 */

import { useQueryClient } from '@tanstack/react-query'
import { type ReactNode, type Ref, useEffect, useLayoutEffect, useRef } from 'react'
import Boton from '../../components/Boton'
import { invalidateResource } from '../../api/keys'
import type { SuccessToast } from '../../components/AvisoExito'
import Icono from '../../components/Icono'
import { SheetLevel, useSheet } from '../../components/useSheetStack'
import { useFlash } from '../../flash/useFlash'
import { useViewport } from '../../shell/useViewport'
import ExpenseNewSheet from '../expenses/ExpenseNewSheet'
import SaleInProgressStrip, { type SaleInProgressWords } from './SaleInProgressStrip'

/** The row's own words, handed down by New sale, which reads the Copy module. */
export interface ExpenseRowWords {
  /** "Other things to record". */
  otherThingsToRecord: string
  /** The tile: "Expense". */
  expense: string
}

interface ExpenseRowProps {
  words: ExpenseRowWords
  /** New sale's ref to the row, whose tile takes focus back when the Sheet closes. */
  rowRef: Ref<HTMLElement>
  /** A sale save is in flight: the row does nothing. */
  locked: boolean
  onOpen: () => void
}

export function ExpenseRow({ words, rowRef, locked, onOpen }: ExpenseRowProps) {
  return (
    <nav ref={rowRef} className="otras-cosas" aria-label={words.otherThingsToRecord} inert={locked}>
      <span className="otras-cosas__titulo" aria-hidden="true">
        {words.otherThingsToRecord}
      </span>
      <div className="otras-cosas__fila">
        <Boton variant="row" onClick={locked ? undefined : onOpen}>
          <span className="otras-cosas__tile">
            <Icono nombre="gastos" />
            {words.expense}
          </span>
        </Boton>
      </div>
    </nav>
  )
}

/** What the host says, handed down by New sale (the Copy module). */
export interface SaleExpenseWords {
  /** The toast armed by a save while a sale is in progress. */
  expenseRecorded: SuccessToast
  strip: Omit<SaleInProgressWords, 'products'>
  /** "N products" for the count of lines with a Product chosen. */
  products: (n: number) => string
}

interface SaleExpenseSheetProps {
  words: SaleExpenseWords
  /** Lines with a Product chosen: the strip shows when it is above 0, and the toast follows it. */
  n: number
  /** New sale's `totals.total` and whether its prices are being recalculated. */
  total: number
  repricing: boolean
  /** The Sheet is over: New sale clears `expenseOpen`. */
  onClosed: () => void
  /** The expense was saved: New sale closes the Sheet. */
  onSaved: () => void
  /** The form reports whether a field differs from how the Sheet opened. */
  onDirtyChange: (dirty: boolean) => void
  /** New sale's one leave confirmation, drawn in the Sheet's aside. Never a blocker: the host owns no guard. */
  leaveConfirm?: ReactNode
}

export default function SaleExpenseSheet({
  words,
  n,
  total,
  repricing,
  onClosed,
  onSaved,
  onDirtyChange,
  leaveConfirm,
}: SaleExpenseSheetProps) {
  const phone = useViewport() === 'phone'
  const queryClient = useQueryClient()
  const flash = useFlash()
  const sheet = useSheet(1)

  // Whether this host has pushed its entry, whether it was seen open, and whether a resize pops
  // the entry on purpose.
  const pushed = useRef(false)
  const seenOpen = useRef(false)
  const switching = useRef(false)
  const latest = useRef({ sheet, onClosed })
  useLayoutEffect(() => {
    latest.current = { sheet, onClosed }
  })

  useEffect(() => {
    if (phone) {
      if (!pushed.current) {
        pushed.current = true
        latest.current.sheet.open()
      }
      return
    }
    if (pushed.current) {
      pushed.current = false
      if (latest.current.sheet.isOpen) {
        switching.current = true
        latest.current.sheet.close()
      }
    }
    latest.current.onClosed()
  }, [phone])

  useEffect(() => {
    if (sheet.isOpen) {
      seenOpen.current = true
      return
    }
    if (!seenOpen.current) return
    seenOpen.current = false
    if (switching.current) {
      switching.current = false
      return
    }
    pushed.current = false
    latest.current.onClosed()
  }, [sheet.isOpen])

  function saved(toast: SuccessToast): void {
    invalidateResource(queryClient, 'expenses')
    flash.armAfterLeaving(n > 0 ? words.expenseRecorded : toast)
    onSaved()
  }

  if (!phone) return null
  return (
    <SheetLevel.Provider value={1}>
      <ExpenseNewSheet
        computer={false}
        banner={
          n > 0 && <SaleInProgressStrip
              words={{ ...words.strip, products: words.products(n) }}
              total={total}
              repricing={repricing}
              onBack={sheet.close}
            />
        }
        onClose={sheet.close}
        onSaved={saved}
        onDirtyChange={onDirtyChange}
        leaveConfirm={leaveConfirm}
      />
    </SheetLevel.Provider>
  )
}
