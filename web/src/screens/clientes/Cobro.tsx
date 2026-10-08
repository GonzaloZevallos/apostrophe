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
 * `payment.*` codes are matched by a local, literal string union here, not
 * through `refusals.ts`'s contract-backed `RefusalCode` (plan, invariants: "a
 * refusal carries a payment.* code ... appears in contract.json in the same
 * diff" — that diff is the `payments-api` subtask's, still open as this one
 * ships; `tests/test_refusal_codes.py` refuses a code in `contract.json` the
 * backend does not yet answer). Once `payments-api` lands those codes, this can
 * move onto `resolveOverride`/`isGone` like every other screen's refusals.
 */

import { type FormEvent, useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, NetworkError } from '../../api/client'
import { invalidateResource, keys } from '../../api/keys'
import {
  type PaymentIn,
  type PaymentMethod,
  previewPayment,
  recordPayment,
} from '../../api/payments'
import Boton from '../../components/Boton'
import LeaveConfirm from '../../components/LeaveConfirm'
import SinConexion from '../../components/SinConexion'
import { useBackOr } from '../../components/useBackOr'
import { useGoneExit } from '../../components/useGoneExit'
import { useLeaveGuard } from '../../components/useLeaveGuard'
import { useFlash } from '../../flash/useFlash'
import { formatDateShort } from '../../format/dates'
import { formatMoney } from '../../format/money'
import { parseMoney } from '../../format/parse'
import { CUSTOMERS } from '../../routes'
import { GENERIC_REFUSAL } from './ClienteForm'

export interface CobroProps {
  customerId: string
  balance: number
  today: string
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

export default function Cobro({ customerId, balance, today }: CobroProps) {
  const [amount, setAmount] = useState(String(balance))
  const [date, setDate] = useState(today)
  const [method, setMethod] = useState<PaymentMethod | null>(null)
  const [amountError, setAmountError] = useState<string | null>(null)
  const [methodError, setMethodError] = useState<string | null>(null)
  const [offline, setOffline] = useState(false)
  const queryClient = useQueryClient()
  const flash = useFlash()

  // Touched means any of the three fields differs from what the sheet opened with.
  const dirty = amount !== String(balance) || date !== today || method !== null
  const { blocker, disarm } = useLeaveGuard(dirty)
  const close = useBackOr(CUSTOMERS)
  const goneExit = useGoneExit('customer-payment', { id: customerId })

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
      disarm()
      close()
    } catch (caught) {
      if (caught instanceof ApiError && isPaymentGone(caught.code)) {
        disarm()
        goneExit()
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
    <div className="capa" role="presentation">
      <div className="capa__contenido">
        <div className="encabezado-fila">
          <span className="panel__titulo">Registrar cobro</span>
          <Boton variant="icon" action="close" ariaLabel="Cerrar" onClick={close} />
        </div>
        <form className="formulario" onSubmit={(event) => void onSubmit(event)}>
          <label className="campo">
            <span className="campo__rotulo">Monto</span>
            <input
              className="campo__input"
              type="text"
              inputMode="numeric"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              required
            />
          </label>
          <Boton variant="link" onClick={() => setAmount(String(balance))}>
            Todo: {formatMoney(balance)}
          </Boton>
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

          {offline && <SinConexion />}

          <Boton textOnly="submit" type="submit" disabled={record.isPending}>
            Guardar
          </Boton>
        </form>
        {blocker.state === 'blocked' && (
          <LeaveConfirm
            blocker={blocker}
            question="¿Descartás el cobro?"
            detail="Se pierde lo que cargaste: todavía no se guardó nada."
            keepLabel="No, seguí cargando"
            discardLabel="Sí, descartalo"
          />
        )}
      </div>
    </div>
  )
}
