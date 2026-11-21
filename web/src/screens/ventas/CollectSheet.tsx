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
 * Received and Change are a helper only: Received is text in this Sheet's own state, Change is what
 * `changeFor` says of it, and neither reaches the body. The helper is hidden by one predicate, the
 * effective choice being owing; what was typed outlives that, a method change and a failed save.
 * The Collect label always holds the full "Collect {total}"; when it overflows, the short word is
 * drawn over it, and the button's name stays the full text.
 *
 * "Owes it" arrives with GH-944 and the failure messages and retry with GH-930, so a rejected save
 * says nothing here: it only releases the Sheet.
 */

import { useMutation } from '@tanstack/react-query'
import { type FormEvent, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { post } from '../../api/client'
import Boton from '../../components/Boton'
import FieldRefusal from '../../components/FieldRefusal'
import Loading from '../../components/Loading'
import MoneyInput from '../../components/MoneyInput'
import Selector from '../../components/Selector'
import Sheet, { SheetActions } from '../../components/Sheet'
import { COMMON_TEXT } from '../../copy/common'
import { SALES_TEXT } from '../../copy/sales'
import { useMoney } from '../../format/moneyContext'
import { choiceOfValue, collectableChoice, selectorValueOf, usePaymentMethodOptions } from '../../sales/paymentMethods'
import {
  lineValidationsOf,
  changeFor,
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
  const receivedId = useId()
  const receivedHelpId = useId()
  const fieldRef = useRef<HTMLButtonElement>(null)
  const labelRef = useRef<HTMLSpanElement>(null)
  const [received, setReceived] = useState('')
  const [short, setShort] = useState(false)
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
  const totalText = money.money(priced.totals.total)
  const owing = effectiveChoice(state.choice, state.proposedMethodId, methodOptions.offeredIds)?.kind === 'owing'
  const change = changeFor(received, priced.totals.total, money.format)

  // The label is measured on mount, when the total or the saving state changes, and on every resize.
  // The full text is always in it, so the label can come back to it.
  useLayoutEffect(() => {
    const label = labelRef.current
    if (saving || label === null) return undefined
    const measure = () => setShort(label.scrollWidth > label.clientWidth)
    measure()
    if (typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(measure)
    observer.observe(label)
    return () => observer.disconnect()
  }, [totalText, saving])

  async function send(body: SaleBody): Promise<void> {
    let sale: SavedSale | null = null
    try {
      sale = await save.mutateAsync(body)
    } catch {
      // A 401 is left to the session boundary; no text for any other cause until GH-930.
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
      <form className="formulario cobro__formulario" onSubmit={collect}>
        <div className="cobro__total">
          <span>{SALES_TEXT.totalLabel}</span> <span className="cifra-n cobro__importe">{totalText}</span>
        </div>
        <div className="cobro__bloque" inert={saving}>
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
          {refused && <FieldRefusal id={refusalId}>{SALES_TEXT.noMethodToCollect}</FieldRefusal>}
          {!owing && (
            <>
              <div className="campo">
                <label htmlFor={receivedId} className="campo__rotulo">
                  {SALES_TEXT.receivedLabel}
                </label>
                <MoneyInput
                  id={receivedId}
                  className="campo__input"
                  autoComplete="off"
                  aria-describedby={receivedHelpId}
                  value={received}
                  onChange={setReceived}
                />
                <span id={receivedHelpId} className="campo__ayuda">
                  {SALES_TEXT.receivedHelp}
                </span>
              </div>
              <div role="status" className="cobro__vuelto">
                {change !== null && (
                  <>
                    <span>{SALES_TEXT.changeLabel}</span> <span className="cifra-n cobro__importe">{money.money(change)}</span>
                  </>
                )}
              </div>
            </>
          )}
        </div>
        <SheetActions>
          <Boton
            textOnly="submit"
            type="submit"
            disabled={methodOptions.selector.loading}
            ariaBusy={saving}
            ariaLabel={saving ? undefined : SALES_TEXT.collect(totalText)}
          >
            {saving ? (
              SALES_TEXT.saving
            ) : (
              <span className="cobro__etiqueta" ref={labelRef}>
                <span className={short ? 'cobro__etiqueta-completa cobro__etiqueta-completa--oculta' : 'cobro__etiqueta-completa'} aria-hidden={short ? true : undefined}>
                  {SALES_TEXT.collect(totalText)}
                </span>
                {short && <span className="cobro__etiqueta-corta">{SALES_TEXT.collectShort}</span>}
              </span>
            )}
          </Boton>
        </SheetActions>
      </form>
    </Sheet>
  )
}
