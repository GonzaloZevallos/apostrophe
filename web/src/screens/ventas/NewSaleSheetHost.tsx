/**
 * `NewSaleSheetHost`: the container of the New sale Sheet. Not routed: nothing mounts it until the New
 * sale flip, and `front-exclude.json` lists it until then (D-62e6dc23). The old guard in `NuevaVenta.tsx`
 * keeps serving the live screen.
 *
 * - One leave guard. The Sale in progress is unsaved work exactly when `isDirty(draft.state)` says so, the
 *   same function the Sheet's own `touched` uses; the host adds no field to `SaleDraftApi`.
 * - Two exits, each a single history traversal: `close()` (the Sheet's Close and Escape at the floor) and
 *   `leave()` (after a save, or what "Yes, discard it" amounts to). The blocker judges the traversal.
 *   On a typed address there is no entry behind the Sheet, so both replace with the parent instead.
 * - The stacked Sheets (customer search with Create customer, Collect) are mounted only while `over` names
 *   them and the router's entry for them exists. Closing one never asks and never touches the lines.
 * - Escape is one bubble-phase listener on `document`; it yields to anything that already handled the key.
 * - The Customer's id lives only in `draft.customerId`; the host keeps just the chosen record's display
 *   fields, and they count only while their id is the draft's.
 */

import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate, useOutletContext } from 'react-router'
import type { Customer } from '../../api/customers'
import { customerTypesQueryOptions } from '../../api/customerTypes'
import type { Me } from '../../api/me'
import LeaveConfirm from '../../components/LeaveConfirm'
import { isInApp } from '../../components/useBackOr'
import { useLeaveGuard } from '../../components/useLeaveGuard'
import { SheetLevel, SheetStackProvider, useSheet, useSheetDepthReader } from '../../components/useSheetStack'
import type { CompleteSale } from '../../sales/newSalePricing'
import { type ChosenCustomer, customerViewOf } from '../../sales/newSaleView'
import { isDirty } from '../../sales/saleDraft'
import { useSaleDraft } from '../../sales/useSaleDraft'
import { parentOf } from '../../routes'
import { useViewport } from '../../shell/useViewport'
import CollectSheet from './CollectSheet'
import { useLeaveQuestion } from './leaveQuestion'
import NuevaVentaCliente from './NuevaVentaCliente'
import NuevaVentaSheet from './NuevaVentaSheet'

/**
 * The Sheet is its route's own entry (depth 0), so a path change is the only way out and this floor never
 * fires. It is passed, with `sheetDirty`, because the brief asks the guard for both.
 */
const SALE_SHEET_FLOOR = 0

type Over = { kind: 'none' } | { kind: 'customer' } | { kind: 'collect'; priced: CompleteSale }

export interface NewSaleSheetHostProps {
  /** Called when Collect's save succeeds; by default the host leaves. */
  onSaved?: (saleId: number, name: string | null) => void
}

export default function NewSaleSheetHost(props: NewSaleSheetHostProps) {
  return (
    <SheetStackProvider>
      <NewSaleSheetBody {...props} />
    </SheetStackProvider>
  )
}

function NewSaleSheetBody({ onSaved }: NewSaleSheetHostProps) {
  const { t } = useTranslation()
  const me = useOutletContext<Me>()
  const navigate = useNavigate()
  const location = useLocation()
  const viewport = useViewport()
  const computer = viewport === 'computer'
  const readDepth = useSheetDepthReader()
  const inApp = isInApp(location.state)

  const draft = useSaleDraft({ today: me.today })
  // There is no shipping field on the Sheet yet, and an empty one never prices to a complete sale: the Sale
  // opens with no shipping charged, as the live screen does ('0'), so Collect can be reached.
  const { setShipping } = draft
  useEffect(() => setShipping('0'), [setShipping])
  const dirty = isDirty(draft.state)
  const { blocker, disarm } = useLeaveGuard(dirty, { sheetFloor: SALE_SHEET_FLOOR, sheetDirty: dirty })
  const words = useLeaveQuestion(blocker, { touched: dirty, strip: false })

  // What is stacked over the Sheet, and the edge that clears it: only a true-to-false edge of level 1.
  const sheet = useSheet(1)
  const [over, setOver] = useState<Over>({ kind: 'none' })
  const [wasOpen, setWasOpen] = useState(sheet.isOpen)
  if (sheet.isOpen && !wasOpen) {
    setWasOpen(true)
  } else if (!sheet.isOpen && wasOpen) {
    setWasOpen(false)
    setOver({ kind: 'none' })
  }

  // The chosen record's display fields; the id that counts is `draft.state.customerId`.
  const [chosen, setChosen] = useState<Omit<ChosenCustomer, 'typeName'> | null>(null)
  const types = useQuery({ ...customerTypesQueryOptions(), enabled: chosen !== null && chosen.typeId !== null })
  const chosenView: ChosenCustomer | null =
    chosen === null
      ? null
      : { ...chosen, typeName: types.data?.find((type) => type.id === chosen.typeId)?.name ?? null }
  const customer = customerViewOf(draft.state.customerId, chosenView)

  function onChosen(picked: Customer | null): void {
    if (picked === null) {
      draft.removeCustomer()
      setChosen(null)
      return
    }
    draft.chooseCustomer(picked.id)
    setChosen({ id: picked.id, name: picked.name, typeId: picked.customer_type_id })
  }

  // Written by Collect's `onSavingChange`; read by the Escape listener, so it is never state.
  const savingRef = useRef(false)

  // Each exit takes effect once per location key it starts from.
  const keyRef = useRef(location.key)
  const exitingFrom = useRef<string | null>(null)
  const previousBlocker = useRef(blocker.state)
  useEffect(() => {
    keyRef.current = location.key
    if (previousBlocker.current === 'blocked' && blocker.state === 'unblocked' && exitingFrom.current === location.key) {
      exitingFrom.current = null
    }
    previousBlocker.current = blocker.state
  }, [blocker.state, location.key])

  function traverse(): void {
    if (exitingFrom.current === keyRef.current) return
    exitingFrom.current = keyRef.current
    if (inApp) {
      void navigate(-(readDepth() - SALE_SHEET_FLOOR + 1))
      return
    }
    const parent = parentOf('sale-new', viewport)
    if (parent === undefined) throw new Error('New sale has no parent screen')
    void navigate(parent.path, { replace: true })
  }

  function close(): void {
    traverse()
  }

  function leave(): void {
    disarm()
    traverse()
  }

  const closeRef = useRef(close)
  useEffect(() => {
    closeRef.current = close
  })
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key !== 'Escape' || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return
      if (event.defaultPrevented || event.isComposing) return
      if (blocker.state === 'blocked') return
      if (over.kind === 'collect' && savingRef.current) return
      if (readDepth() > SALE_SHEET_FLOOR) sheet.close()
      else closeRef.current()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [blocker.state, over.kind, readDepth, sheet])

  function ask(next: Over): void {
    setOver(next)
    sheet.open()
  }

  const frame = { computer, computerClass: 'pantalla cobro-modal', computerDialog: true }
  return (
    <>
      <NuevaVentaSheet
        draft={draft}
        customer={customer}
        onClose={close}
        onChangeCustomer={() => ask({ kind: 'customer' })}
        onCollect={(sale) => ask({ kind: 'collect', priced: sale })}
        {...frame}
      />
      {over.kind === 'customer' && sheet.isOpen && <NuevaVentaCliente allowNone onChosen={onChosen} />}
      {over.kind === 'collect' && sheet.isOpen && (
        // Collect is the first Sheet over the form: its method Selector opens one entry over it.
        <SheetLevel.Provider value={1}>
        <CollectSheet
          draft={draft}
          priced={over.priced}
          customerName={customer.kind === 'known' ? customer.name : null}
          onClose={sheet.close}
          onSaved={(sale) => {
            const name = customer.kind === 'known' ? customer.name : null
            if (onSaved === undefined) leave()
            else onSaved(sale.id, name)
          }}
          onSavingChange={(saving) => {
            savingRef.current = saving
          }}
          {...frame}
        />
        </SheetLevel.Provider>
      )}
      {words !== null && (
        <LeaveConfirm
          blocker={blocker}
          question={words.question}
          detail={words.detail}
          keepLabel={t('common:noKeepEntering')}
          discardLabel={t('common:yesDiscard')}
        />
      )}
    </>
  )
}
