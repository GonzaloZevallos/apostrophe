/**
 * "Registrar cobro" (`Cobro`, `payments.md`): the form, drawn inside `CobroFrame` by its host
 * `CobroRoute` (`Cobro.dc.html` on a phone, `CobroCompu.dc.html` on a computer). "Todo: $ X"
 * fills the amount with the customer's own `balance` (never typed in by the seller for that
 * case); the date defaults to today; Efectivo · Transferencia is required. The host owns how it
 * is left (the leave guard, Escape, the backdrop, where "Cerrar" goes): this form only says
 * through `onDone`, `onCancel`, `onGone`, `onDirtyChange` and `onSendingChange` what happened.
 *
 * The browser computes nothing (plan, invariants: "the front never adds grams or
 * amounts"): before saving, `POST .../payments/preview` is the one source for
 * which sales the payment settles and what is left. Debounced 150 ms after the
 * amount or the date changes (the same delay `Clientes`' own search box uses)
 * before it becomes `keys.paymentPreview`'s key, so a seller still typing a
 * figure does not fire one request per keystroke. The key is a form-only one
 * (`keys.ts`) frozen with `gcTime: 0` so an old preview never lingers in the
 * cache once the form closes. The last answer tanstack query holds for the
 * *current* key is always the one shown.
 *
 * `payment.*` codes are matched by a local, literal string union here, not
 * through `refusals.ts`'s contract-backed `RefusalCode`.
 */

import { type FormEvent, type RefObject, useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, NetworkError } from '../../api/client'
import { invalidateResource, keys } from '../../api/keys'
import {
  type PaymentIn,
  type PaymentMethod,
  type Standing,
  previewPayment,
  recordPayment,
} from '../../api/payments'
import Boton from '../../components/Boton'
import SinConexion from '../../components/SinConexion'
import { useFlash } from '../../flash/useFlash'
import { formatDateShort } from '../../format/dates'
import { formatMoney } from '../../format/money'
import { parseMoney } from '../../format/parse'
import { GENERIC_REFUSAL } from './ClienteForm'

export interface CobroProps {
  customerId: string
  /** The customer's name and standing, for the line under the title: all from the API. */
  customer: { name: string; balance: number; owing_since: string | null; standing: Standing }
  today: string
  /** The id of the title the dialog is named by, and the ref the host focuses it through. */
  titleId: string
  titleRef: RefObject<HTMLSpanElement | null>
  /** "Cerrar": the host's one `leave`. */
  onCancel: () => void
  /** A payment was saved and its toast is armed: the host disarms its guard and leaves. */
  onDone: () => void
  /** The customer or the payment is gone: the host disarms its guard and takes the gone exit. */
  onGone: () => void
  onDirtyChange: (dirty: boolean) => void
  onSendingChange: (sending: boolean) => void
}

type PaymentRefusalCode =
  | 'payment.above_balance'
  | 'payment.future_date'
  | 'payment.amount_invalid'
  | 'payment.method_required'
  | 'payment.customer_not_found'
  | 'payment.not_found'

const GONE_CODES: ReadonlySet<PaymentRefusalCode> = new Set([
  'payment.customer_not_found',
  'payment.not_found',
])

const AMOUNT_MESSAGES: Partial<Record<PaymentRefusalCode, string>> = {
  'payment.above_balance': 'El monto supera lo que te debe.',
  'payment.future_date': 'La fecha no puede ser futura.',
  'payment.amount_invalid': 'Ingresá un monto válido.',
}
const METHOD_REQUIRED_MESSAGE = 'Elegí efectivo o transferencia.'

/** `code` comes off the wire as a plain `string` (`ApiError.code`): this only
 * narrows it enough to index `AMOUNT_MESSAGES` safely, never asserting it is a
 * `payment.*` code the backend actually answers. */
function amountMessage(code: string): string | undefined {
  return Object.prototype.hasOwnProperty.call(AMOUNT_MESSAGES, code)
    ? AMOUNT_MESSAGES[code as PaymentRefusalCode]
    : undefined
}

function isPaymentGone(code: string): boolean {
  return (GONE_CODES as ReadonlySet<string>).has(code)
}

export default function Cobro({
  customerId,
  customer,
  today,
  titleId,
  titleRef,
  onCancel,
  onDone,
  onGone,
  onDirtyChange,
  onSendingChange,
}: CobroProps) {
  const balance = customer.balance
  const [amount, setAmount] = useState(String(balance))
  const [date, setDate] = useState(today)
  const [method, setMethod] = useState<PaymentMethod | null>(null)
  const [amountError, setAmountError] = useState<string | null>(null)
  const [methodError, setMethodError] = useState<string | null>(null)
  const [offline, setOffline] = useState(false)
  const queryClient = useQueryClient()
  const flash = useFlash()

  // Touched means any of the three fields differs from what the form opened with.
  const dirty = amount !== String(balance) || date !== today || method !== null
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange])

  const parsedAmount = parseMoney(amount)

  const previewAmount = parsedAmount.ok ? parsedAmount.value : null

  // Debounced 150 ms behind the amount/date the seller is typing (same delay as
  // `Clientes`' search box): the preview's own query key only moves once typing
  // pauses, so a figure typed digit by digit fires one request, not one per key.
  const [debouncedAmount, setDebouncedAmount] = useState(previewAmount)
  const [debouncedDate, setDebouncedDate] = useState(date)
  useEffect(() => {
    const id = setTimeout(() => {
      setDebouncedAmount(previewAmount)
      setDebouncedDate(date)
    }, 150)
    return () => clearTimeout(id)
  }, [previewAmount, date])

  const preview = useQuery({
    queryKey: keys.paymentPreview(customerId, debouncedDate, debouncedAmount ?? 0),
    queryFn: () => previewPayment(customerId, { paid_on: debouncedDate, amount: debouncedAmount ?? 0 }),
    enabled: debouncedAmount !== null,
    gcTime: 0,
    retry: false,
  })

  const record = useMutation({
    mutationFn: (body: PaymentIn) => recordPayment(customerId, body),
  })
  useEffect(() => onSendingChange(record.isPending), [record.isPending, onSendingChange])

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setAmountError(null)
    setMethodError(null)
    setOffline(false)
    if (!parsedAmount.ok) {
      setAmountError('Ingresá un monto válido.')
      return
    }
    if (method === null) {
      setMethodError(METHOD_REQUIRED_MESSAGE)
      return
    }
    try {
      const recorded = await record.mutateAsync({ paid_on: date, amount: parsedAmount.value, method })
      invalidateResource(queryClient, 'payments')
      flash.armAfterLeaving(
        recorded.after.standing === 'owes'
          ? `Cobro guardado · queda debiendo ${formatMoney(recorded.after.balance)}`
          : 'Cobro guardado',
      )
      onDone()
    } catch (caught) {
      if (caught instanceof ApiError && isPaymentGone(caught.code)) {
        onGone()
      } else if (caught instanceof ApiError) {
        if (caught.code === 'payment.method_required') setMethodError(METHOD_REQUIRED_MESSAGE)
        else setAmountError(amountMessage(caught.code) ?? GENERIC_REFUSAL)
      } else if (caught instanceof NetworkError) {
        setOffline(true)
      } else {
        setAmountError(GENERIC_REFUSAL)
      }
    }
  }

  return (
    <>
      <div className="encabezado-fila">
        <span ref={titleRef} id={titleId} tabIndex={-1} className="panel__titulo">
          Registrar cobro
        </span>
        <Boton variant="icon" action="close" ariaLabel="Cerrar" onClick={onCancel} />
      </div>
      <span className="cobro__cliente">
        {customer.name}
        {customer.standing === 'owes' && customer.owing_since !== null
          ? ` · te debe ${formatMoney(customer.balance)} desde el ${formatDateShort(customer.owing_since)}`
          : ''}
      </span>
        <form className="formulario" onSubmit={(event) => void onSubmit(event)}>
          <label className="campo">
            <span className="campo__rotulo">Monto</span>
            <input
              className="campo__input cobro__monto"
              type="text"
              inputMode="numeric"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              required
            />
          </label>
          <div className="cobro__todo">
            <Boton variant="link" onClick={() => setAmount(String(balance))}>
              Todo: {formatMoney(balance)}
            </Boton>
          </div>
          {amountError !== null && (
            <span className="campo__error" role="alert">
              {amountError}
            </span>
          )}

          <label className="campo">
            <span className="campo__rotulo">Fecha</span>
            <input
              className="campo__input"
              type="date"
              value={date}
              max={today}
              onChange={(event) => setDate(event.target.value)}
              required
            />
          </label>

          <fieldset className="campo cobro__metodo">
            <legend className="campo__rotulo">Método</legend>
            <label>
              <input
                type="radio"
                name="cobro-method"
                checked={method === 'cash'}
                onChange={() => setMethod('cash')}
              />
              Efectivo
            </label>
            <label>
              <input
                type="radio"
                name="cobro-method"
                checked={method === 'transfer'}
                onChange={() => setMethod('transfer')}
              />
              Transferencia
            </label>
            {methodError !== null && (
              <span className="campo__error" role="alert">
                {methodError}
              </span>
            )}
          </fieldset>

          {parsedAmount.ok && preview.data !== undefined && (
            <div className="campo cobro__resumen">
              <span className="campo__rotulo">Se descuenta de la deuda más vieja</span>
              {preview.data.applied_to.map((split) => (
                <span key={split.sale_id}>
                  {formatMoney(split.amount)} a la venta del {formatDateShort(split.sale_date)}
                </span>
              ))}
              {preview.data.after.standing === 'owes' && (
                <span>Le queda debiendo {formatMoney(preview.data.after.balance)}</span>
              )}
            </div>
          )}

          {offline && <SinConexion />}

          <Boton textOnly="submit" type="submit" disabled={record.isPending}>
            Guardar
          </Boton>
        </form>
    </>
  )
}
