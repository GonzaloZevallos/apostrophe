/**
 * "Registrar cobro" (`Cobro`, `payments.md`): a sheet over `ClienteFicha`, the
 * same `.capa`/`.capa__contenido` layer `NuevaVentaCliente` uses. "Todo: $ X"
 * fills the amount with the customer's own `balance` (never typed in by the
 * seller for that case); the date defaults to today; Efectivo · Transferencia is
 * required.
 *
 * The browser computes nothing (plan, invariants: "the front never adds grams or
 * amounts"): before saving, `POST .../payments/preview` is the one source for
 * which sales the payment settles and what is left. Debounced 150 ms after the
 * amount or the date changes (the same delay `Clientes`' own search box uses)
 * before it becomes `keys.paymentPreview`'s key, so a seller still typing a
 * figure does not fire one request per keystroke. The key is a form-only one
 * (`keys.ts`) frozen with `gcTime: 0` so an old preview never lingers in the
 * cache once the sheet closes. The last answer tanstack query holds for the
 * *current* key is always the one shown — an in-flight call for an amount the
 * seller has since changed is simply never the active query anymore.
 *
 * The balance is never handed in: on open the sheet reads `GET /customers/{id}`
 * itself, under `keys.cobroCustomer` (form-only, frozen: `gcTime: 0`,
 * `staleTime: Infinity`, no refetch on focus or reconnect), so "Todo" and the
 * pre-filled amount are the balance as it stands now, never a figure some list
 * showed earlier. Until that answer arrives there is no amount and no "Todo".
 *
 * Refusals map through `refusals.ts`'s contract-backed `RefusalCode`
 * (`resolveOverride`, `isGone`), like every other screen's.
 */

import { type FormEvent, useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, NetworkError } from '../api/client'
import { getCustomer } from '../api/customers'
import { invalidateResource, keys } from '../api/keys'
import {
  type PaymentIn,
  type PaymentMethod,
  type RecordedPayment,
  previewPayment,
  recordPayment,
} from '../api/payments'
import { type RefusalCode, isGone, resolveOverride } from '../api/refusals'
import { formatDateShort } from '../format/dates'
import { formatMoney } from '../format/money'
import { parseMoney } from '../format/parse'
import { GENERIC_REFUSAL } from './feedback'
import SinConexion from './SinConexion'

export interface CobroProps {
  customerId: string
  today: string
  onClose: () => void
  onSaved: (recorded: RecordedPayment) => void
  onGone: () => void
}

const AMOUNT_MESSAGES: Partial<Record<RefusalCode, string>> = {
  'payment.above_balance': 'El monto supera lo que te debe.',
  'payment.future_date': 'La fecha no puede ser futura.',
  'payment.amount_invalid': 'Ingresá un monto válido.',
}
const METHOD_REQUIRED_MESSAGE = 'Elegí efectivo o transferencia.'

export default function Cobro({ customerId, today, onClose, onSaved, onGone }: CobroProps) {
  // `null` until the seller types: the amount then shows the balance as read now.
  const [typedAmount, setTypedAmount] = useState<string | null>(null)
  const [date, setDate] = useState(today)
  const [method, setMethod] = useState<PaymentMethod | null>(null)
  const [amountError, setAmountError] = useState<string | null>(null)
  const [methodError, setMethodError] = useState<string | null>(null)
  const [offline, setOffline] = useState(false)
  const queryClient = useQueryClient()

  const customer = useQuery({
    queryKey: keys.cobroCustomer(customerId),
    queryFn: () => getCustomer(customerId),
    gcTime: 0,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  })
  const balance = customer.data?.balance
  const amount = typedAmount ?? (balance === undefined ? '' : String(balance))
  const customerError = customer.error
  const customerGone =
    customerError instanceof ApiError && (customerError.status === 404 || isGone(customerError.code))
  // `onGone` is the caller's own closure, new on every render: held in a ref so
  // the effect fires once per answer, not once per render.
  const onGoneRef = useRef(onGone)
  useEffect(() => {
    onGoneRef.current = onGone
  })
  useEffect(() => {
    if (customerGone) onGoneRef.current()
  }, [customerGone])

  const parsedAmount = parseMoney(amount)

  const previewAmount = parsedAmount.ok ? parsedAmount.value : null

  // Debounced 150 ms behind the amount/date the seller is typing (same delay as
  // `Clientes`' search box): the preview's own query key only moves once typing
  // pauses, so a figure typed digit by digit fires one request, not one per key.
  // The amount pre-filled from the balance is not typing: it previews at once, as
  // it did when the balance was handed in, so a quick save never overtakes it.
  const [debouncedAmount, setDebouncedAmount] = useState(previewAmount)
  const [debouncedDate, setDebouncedDate] = useState(date)
  const prefilled = typedAmount === null && date === debouncedDate
  useEffect(() => {
    const id = setTimeout(
      () => {
        setDebouncedAmount(previewAmount)
        setDebouncedDate(date)
      },
      prefilled ? 0 : 150,
    )
    return () => clearTimeout(id)
  }, [previewAmount, date, prefilled])

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
      onSaved(recorded)
    } catch (caught) {
      if (caught instanceof ApiError && isGone(caught.code)) {
        onGone()
      } else if (caught instanceof ApiError) {
        if (caught.code === 'payment.method_required') setMethodError(METHOD_REQUIRED_MESSAGE)
        else setAmountError(resolveOverride(AMOUNT_MESSAGES, caught.code) ?? GENERIC_REFUSAL)
      } else if (caught instanceof NetworkError) {
        setOffline(true)
      } else {
        setAmountError(GENERIC_REFUSAL)
      }
    }
  }

  return (
    <div className="capa" role="presentation">
      <div className="capa__contenido">
        <span className="panel__titulo">Registrar cobro</span>
        <form className="formulario" onSubmit={(event) => void onSubmit(event)}>
          <label className="campo">
            <span className="campo__rotulo">Monto</span>
            <input
              className="campo__input"
              type="text"
              inputMode="numeric"
              value={amount}
              onChange={(event) => setTypedAmount(event.target.value)}
              required
            />
          </label>
          {balance !== undefined && (
            <button type="button" className="boton-enlace" onClick={() => setTypedAmount(String(balance))}>
              Todo: {formatMoney(balance)}
            </button>
          )}
          {customerError instanceof NetworkError && <SinConexion />}
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

          <fieldset className="campo">
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
            <div className="campo">
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

          {offline && customerError === null && <SinConexion />}

          <button className="boton" type="submit" disabled={record.isPending}>
            Guardar
          </button>
          <button type="button" className="boton-enlace" onClick={onClose}>
            Cancelar
          </button>
        </form>
      </div>
    </div>
  )
}
