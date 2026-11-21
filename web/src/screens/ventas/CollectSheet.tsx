/**
 * `CollectSheet`: the closing step of New sale (drawing `NuevaVentaCobrar` and its dark twin, with
 * accepted departure 3), drawn inside the shared `Sheet` as `Cobro`/`CobroRoute` are. "Collect
 * Sheet" is a code name for an instance of the glossary's Sheet, not a new kind of surface.
 *
 * It is not routed and nothing reaches it until the flip part of GH-496. Its host:
 * - opens it only when every line is priced, and keeps it mounted while it saves;
 * - owns Escape, the system back and any cache work after a success: this Sheet adds no Escape or
 *   popstate listener, and its own Close does nothing while a save is in flight;
 * - hands it the one `PricedSale`: every figure here comes from `priced`, never from a price call.
 *
 * The order on a tap on Collect: an unpriced line is a silent no-op, then the method error (no
 * request, the refusal at the field, focus on it), then save. The payment is decided only through
 * `collectableChoice(effectiveChoice(...))` and refused only through `validateSale`; the body is
 * built only by `saleBodyOf`.
 *
 * "Owes it" arrives with GH-944. A save that fails always releases the Sheet (`onSavingChange(false)`,
 * Close works again) and keeps the method and the lines. A 401 is left to the session boundary and
 * shows nothing. The refusal that the chosen method is no longer available (`isMethodUnavailable`,
 * the same predicate New sale uses) marks the method in the Selector, reads the list again, and
 * from then on that method counts as no method. Any other cause shows `SALES_TEXT.saleNotSaved`
 * above Collect, never the API's `detail`. A failed methods list never blocks a $0 sale: Collect
 * is disabled only while the list is being read, the browser is online and the total is above $0.
 * The save never pauses offline (`networkMode: 'always'`), so it always ends.
 */

import { onlineManager, useMutation, useQueryClient } from '@tanstack/react-query'
import { Fragment, type FormEvent, type ReactNode, useEffect, useId, useRef, useState, useSyncExternalStore } from 'react'
import { ApiError, post } from '../../api/client'
import { keys } from '../../api/keys'
import Boton from '../../components/Boton'
import FieldRefusal from '../../components/FieldRefusal'
import Loading from '../../components/Loading'
import Selector from '../../components/Selector'
import Sheet, { SheetActions } from '../../components/Sheet'
import { useTranslation } from 'react-i18next'
import { COMMON_TEXT } from '../../copy/common'
import { OWING_HINT, SALES_TEXT } from '../../copy/sales'
import { useMoney } from '../../format/moneyContext'
import {
  choiceOfValue,
  collectableChoice,
  howTheyPayView,
  paymentMethodName,
  usePaymentMethodOptions,
} from '../../sales/paymentMethods'
import {
  lineValidationsOf,
  paymentChoiceOf,
  payStateOfEffective,
  type PricedSale,
  validateSale,
} from '../../sales/pricing'
import { bodyLinesOf, type SaleBody, saleBodyOf } from '../../sales/saleBody'
import { effectiveChoice } from '../../sales/saleDraft'
import { isMethodUnavailable } from '../../sales/saleRefusal'
import type { SaleDraftApi } from '../../sales/useSaleDraft'

/** What the server answers a saved sale with; the Sheet hands it on untouched. */
export interface SavedSale {
  id: number
}

export interface CollectSheetProps {
  draft: SaleDraftApi
  /** The host's single price source: never recomputed here. */
  priced: PricedSale
  customerName: string | null
  onClose: () => void
  onSaved: (sale: SavedSale) => void
  /** Told true when a save starts and false when it ends, however it ends. */
  onSavingChange: (saving: boolean) => void
  /** The Sheet frame, passed through (`computerClass` is the host's own frame on a computer). */
  computer: boolean
  computerClass: string
  computerDialog: boolean
}

export default function CollectSheet({
  draft,
  priced,
  customerName,
  onClose,
  onSaved,
  onSavingChange,
  computer,
  computerClass,
  computerDialog,
}: CollectSheetProps) {
  const money = useMoney()
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const titleId = useId()
  const refusalId = useId()
  const listLineId = useId()
  const notSavedId = useId()
  const methodOptions = usePaymentMethodOptions()
  const online = useSyncExternalStore(onlineManager.subscribe, () => onlineManager.isOnline())
  const fieldRef = useRef<HTMLButtonElement>(null)
  // What stopped the last Collect, and the one cause that set it: it shows only while that cause holds.
  const [refusal, setRefusal] = useState<'method' | 'customer' | null>(null)
  // The method the server said is no longer available: kept in the field with the mark, never offered.
  const [methodGone, setMethodGone] = useState<{ id: number; name: string } | null>(null)
  // Every id this Sheet was refused for, kept for its whole life: never offered and never sent again,
  // whether or not the list was read again (the mark above clears on another pick, this does not).
  const [refusedIds, setRefusedIds] = useState<readonly number[]>([])
  const [notSaved, setNotSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  // The guard is a ref set before the request: two taps in one frame still make one request.
  const savingRef = useRef(false)
  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])
  // `networkMode: 'always'`: offline the request fails and the save ends, instead of pausing with the Sheet locked.
  const save = useMutation({ mutationFn: (body: SaleBody) => post<SavedSale>('/sales', body), networkMode: 'always' })

  const { state } = draft

  // A refusal never outlives a change of Customer or of choice kind: reset while rendering, with no effect.
  const [seen, setSeen] = useState({ customerId: state.customerId, kind: state.choice.kind })
  if (seen.customerId !== state.customerId || seen.kind !== state.choice.kind) {
    setSeen({ customerId: state.customerId, kind: state.choice.kind })
    setRefusal(null)
  }

  /** Focuses the method field, or the group around it while the field is disabled (the list is loading). */
  function focusMethodField(): void {
    const field = fieldRef.current
    if (field === null) return
    if (!field.disabled) {
      field.focus()
      return
    }
    const group = field.closest('[role="group"]')
    if (group instanceof HTMLElement) group.focus()
  }

  async function send(body: SaleBody, paid: number | null): Promise<void> {
    let sale: SavedSale | null = null
    try {
      sale = await save.mutateAsync(body)
    } catch (caught) {
      if (mountedRef.current) {
        if (caught instanceof ApiError && caught.status === 401) {
          // Left to the session boundary (queryClient's MutationCache.onError): nothing to show here.
        } else if (isMethodUnavailable(caught)) {
          if (paid !== null) {
            setMethodGone({ id: paid, name: paymentMethodName(queryClient, paid) ?? '' })
            setRefusedIds((ids) => (ids.includes(paid) ? ids : [...ids, paid]))
          }
          void queryClient.invalidateQueries({ queryKey: keys.paymentMethods() })
        } else {
          setNotSaved(true)
        }
      }
    } finally {
      savingRef.current = false
      if (mountedRef.current) {
        setSaving(false)
        onSavingChange(false)
      }
    }
    if (sale !== null && mountedRef.current) {
      setMethodGone(null)
      setNotSaved(false)
      onSaved(sale)
    }
  }

  function collect(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    if (savingRef.current) return
    const chosen = collectableChoice(effectiveChoice(state.choice, state.proposedMethodId, methodOptions.offeredIds))
    // A method the server refused as no longer available counts as no method, whether or not the list was read again.
    const effective =
      chosen !== null && chosen.kind === 'paid' && refusedIds.includes(chosen.payment_method_id) ? null : chosen
    const pay = payStateOfEffective(effective)
    const errors = validateSale({
      ...pay,
      total: priced.totals.total,
      hasCustomer: state.customerId !== null,
      lines: lineValidationsOf(priced),
    })
    if (errors.some((error) => error.field.startsWith('line:'))) return
    const stopping = errors.find((error) => error.field === 'method' || error.field === 'customer')
    if (stopping !== undefined) {
      setRefusal(stopping.field === 'customer' ? 'customer' : 'method')
      focusMethodField()
      return
    }
    savingRef.current = true
    setSaving(true)
    setRefusal(null)
    setNotSaved(false)
    onSavingChange(true)
    void send(
      saleBodyOf({
        date: state.date,
        customerId: state.customerId,
        shippingCharged: priced.totals.shippingCharged,
        note: state.note,
        payment: paymentChoiceOf(pay.payState, pay.method, priced.totals.total),
        lines: bodyLinesOf(state.lines),
      }),
      effective?.kind === 'paid' ? effective.payment_method_id : null,
    )
  }

  const view = howTheyPayView({
    choice: state.choice,
    customerId: state.customerId,
    proposedMethodId: state.proposedMethodId,
    offeredIds: methodOptions.offeredIds,
    methodOptions: methodOptions.selector.options,
    refusedIds,
    methodGone,
    owesItLabel: SALES_TEXT.owesIt,
  })
  const owing = state.choice.kind === 'owing'
  // The lines under the field: each has an id, and the field points at exactly the ones drawn.
  // A refusal of this Collect replaces the "no longer available" line, as it always did.
  const lines: { id: string; node: ReactNode }[] = []
  if (refusal === 'customer' && owing && state.customerId === null) {
    lines.push({ id: refusalId, node: <FieldRefusal id={refusalId}>{OWING_HINT}</FieldRefusal> })
  } else if (refusal === 'method' && !owing) {
    lines.push({ id: refusalId, node: <FieldRefusal id={refusalId}>{SALES_TEXT.noMethodToCollect}</FieldRefusal> })
  } else if (methodGone !== null) {
    lines.push({
      id: refusalId,
      node: <FieldRefusal id={refusalId}>{t('common:paymentMethodUnavailable')}</FieldRefusal>,
    })
  }
  // With "Owes it" in the list the Selector's own empty/failed message never shows (the list is not
  // empty), so the Sheet says it. An empty list is read on the server's list, before the refused ids go.
  if (
    !methodOptions.selector.loading &&
    state.customerId !== null &&
    (methodOptions.failure !== null || methodOptions.offeredIds?.length === 0)
  ) {
    lines.push({
      id: listLineId,
      node:
        methodOptions.failure !== null ? (
          <FieldRefusal id={listLineId}>{methodOptions.selector.emptySetMessage}</FieldRefusal>
        ) : (
          <span id={listLineId} className="campo__ayuda" data-copy="help">
            {methodOptions.selector.emptySetMessage}
          </span>
        ),
    })
  }

  return (
    <Sheet
      computer={computer}
      computerClass={computerClass}
      computerDialog={computerDialog}
      titleId={titleId}
      touched
      onClose={() => {
        if (!savingRef.current) onClose()
      }}
    >
      <div className="encabezado-fila">
        <span id={titleId} className="panel__titulo">
          {SALES_TEXT.collectTitle(priced.lines.length)}
        </span>
        <Boton
          variant="icon"
          action="close"
          ariaLabel={COMMON_TEXT.close}
          onClick={() => {
            if (!savingRef.current) onClose()
          }}
        />
      </div>
      <span className="cobro__cliente">
        {state.customerId === null ? SALES_TEXT.noCustomer : (customerName ?? <Loading compacto />)}
      </span>
      <form className="formulario" onSubmit={collect}>
        <div inert={saving}>
          {/* A tap on a field whose list failed reads the list again; the Selector shows its own failure line. */}
          <div onClickCapture={methodOptions.failure === null ? undefined : methodOptions.reload}>
            <Selector
              {...methodOptions.selector}
              options={view.options}
              placeholder={SALES_TEXT.chooseMethod}
              label={SALES_TEXT.howTheyPay}
              value={view.value}
              selected={view.selected}
              onChange={(value) => {
                draft.setChoice(choiceOfValue(value))
                setRefusal(null)
                setNotSaved(false)
                if (methodGone !== null && value !== String(methodGone.id)) setMethodGone(null)
              }}
              fieldRef={fieldRef}
              describedBy={lines.length === 0 ? undefined : lines.map((line) => line.id).join(' ')}
            />
          </div>
        </div>
        {lines.map((line) => (
          <Fragment key={line.id}>{line.node}</Fragment>
        ))}
        {notSaved && <FieldRefusal id={notSavedId}>{SALES_TEXT.saleNotSaved}</FieldRefusal>}
        <SheetActions>
          <Boton
            textOnly="submit"
            type="submit"
            disabled={methodOptions.selector.loading && online && priced.totals.total > 0}
            ariaBusy={saving}
          >
            {saving ? SALES_TEXT.saving : SALES_TEXT.collect(money.money(priced.totals.total))}
          </Boton>
        </SheetActions>
      </form>
    </Sheet>
  )
}
