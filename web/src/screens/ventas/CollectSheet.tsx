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
 * "Owes it" arrives with #944 and the failure messages and retry with #930, so a rejected save
 * says nothing here: it only releases the Sheet.
 */

import { useMutation } from '@tanstack/react-query'
import { type FormEvent, useEffect, useId, useRef, useState } from 'react'
import { post } from '../../api/client'
import Boton from '../../components/Boton'
import FieldRefusal from '../../components/FieldRefusal'
import Loading from '../../components/Loading'
import Selector from '../../components/Selector'
import Sheet, { SheetActions } from '../../components/Sheet'
import { COMMON_TEXT } from '../../copy/common'
import { SALES_TEXT } from '../../copy/sales'
import { useMoney } from '../../format/moneyContext'
import { choiceOfValue, collectableChoice, selectorValueOf, usePaymentMethodOptions } from '../../sales/paymentMethods'
import {
  lineValidationsOf,
  paymentChoiceOf,
  payStateOfEffective,
  type PricedSale,
  validateSale,
} from '../../sales/pricing'
import { bodyLinesOf, type SaleBody, saleBodyOf } from '../../sales/saleBody'
import { effectiveChoice } from '../../sales/saleDraft'
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
  const titleId = useId()
  const refusalId = useId()
  const methodOptions = usePaymentMethodOptions()
  const fieldRef = useRef<HTMLButtonElement>(null)
  const [refused, setRefused] = useState(false)
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
  const save = useMutation({ mutationFn: (body: SaleBody) => post<SavedSale>('/sales', body) })

  const { state } = draft

  async function send(body: SaleBody): Promise<void> {
    let sale: SavedSale | null = null
    try {
      sale = await save.mutateAsync(body)
    } catch {
      // A 401 is left to the session boundary; no text for any other cause until #930.
      sale = null
    } finally {
      savingRef.current = false
      if (mountedRef.current) {
        setSaving(false)
        onSavingChange(false)
      }
    }
    if (sale !== null && mountedRef.current) onSaved(sale)
  }

  function collect(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    if (savingRef.current) return
    const effective = collectableChoice(effectiveChoice(state.choice, state.proposedMethodId, methodOptions.offeredIds))
    const pay = payStateOfEffective(effective)
    const errors = validateSale({
      ...pay,
      total: priced.totals.total,
      hasCustomer: state.customerId !== null,
      lines: lineValidationsOf(priced),
    })
    if (errors.some((error) => error.field.startsWith('line:'))) return
    if (errors.some((error) => error.field === 'method')) {
      setRefused(true)
      fieldRef.current?.focus()
      return
    }
    savingRef.current = true
    setSaving(true)
    setRefused(false)
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
    )
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
          <Selector
            {...methodOptions.selector}
            placeholder={SALES_TEXT.chooseMethod}
            label={SALES_TEXT.howTheyPay}
            value={selectorValueOf(state.choice, state.proposedMethodId, methodOptions.offeredIds)}
            onChange={(value) => {
              draft.setChoice(choiceOfValue(value))
              setRefused(false)
            }}
            fieldRef={fieldRef}
            describedBy={refused ? refusalId : undefined}
          />
        </div>
        {refused && <FieldRefusal id={refusalId}>{SALES_TEXT.noMethodToCollect}</FieldRefusal>}
        <SheetActions>
          <Boton textOnly="submit" type="submit" disabled={methodOptions.selector.loading} ariaBusy={saving}>
            {saving ? SALES_TEXT.saving : SALES_TEXT.collect(money.money(priced.totals.total))}
          </Boton>
        </SheetActions>
      </form>
    </Sheet>
  )
}
