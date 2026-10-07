/**
 * `ClienteFicha`: a customer's card — phone, channel, VIP, the balance and
 * "Registrar cobro" (`payments.md`, "On screen"). Every figure here —
 * `balance`, `owing_since`, `standing`, the account's rows and their own
 * `running_balance`/`standing` — is the payments domain's own answer
 * (`settle()`), never computed here (plan, invariants): this screen only reads
 * `standing` (or a row's `kind`) to choose a label, never a sign on `balance` or
 * `running_balance`. A `gone` answer (another business's id, or an old link)
 * shows `GoneScreen`, never a 403 or a hint that a record exists somewhere else
 * (ADR-0004).
 */

import { CUSTOMERS, CUSTOMER_EDIT, CUSTOMER_PAYMENT, SALE_NEW, pathTo } from '../../routes'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocation, useOutletContext, useParams } from 'react-router'
import InAppLink from '../../components/InAppLink'
import { useGoneNotice } from '../../components/goneExit'
import { ApiError, NetworkError } from '../../api/client'
import { type Channel, getCustomer } from '../../api/customers'
import { invalidateResource, keys } from '../../api/keys'
import type { Me } from '../../api/me'
import { useIsVipCustomers } from '../../api/pricingSettings'
import {
  type AccountRow,
  type HowPaid,
  type PaymentMethod,
  deletePayment,
  getAccount,
} from '../../api/payments'
import { GONE_NOTICE, isGone } from '../../api/refusals'

// `payment.not_found` is not yet in `contract.json` (`isGone` would answer
// `false` for it): that code's own `kind: "gone"` entry ships with the
// `payments-api` subtask's diff, the same diff that answers it (plan,
// invariants: a refusal's code and its `contract.json` entry land together).
// Checked here by its literal string, not through the shared, contract-backed
// `isGone`, until that lands.
const PAYMENT_NOT_FOUND = 'payment.not_found'
import ConfirmDialog from '../../components/ConfirmDialog'
import ErrorGenerico from '../../components/ErrorGenerico'
import { newSaleFor, readFeedback } from '../../components/feedback'
import GoneScreen from '../../components/GoneScreen'
import Notice from '../../components/Notice'
import SinConexion from '../../components/SinConexion'
import Loading from '../../components/Loading'
import { formatDateShort } from '../../format/dates'
import { formatMoney, formatMoneyMagnitude } from '../../format/money'
import { formatPhone } from '../../format/phone'
import Cobro from './Cobro'

const CHANNEL_LABEL: Record<Channel, string> = {
  telegram: 'Telegram',
  whatsapp: 'WhatsApp',
}

const HOW_PAID_LABEL: Record<Exclude<HowPaid, 'none'>, string> = {
  cash: 'Pagada por efectivo',
  transfer: 'Pagada por transferencia',
  owing: 'Quedó debiendo',
}

const METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: 'efectivo',
  transfer: 'transferencia',
}

function deletePaymentTitle(payment: { amount: number; method: PaymentMethod; paid_on: string }): string {
  return `¿Borrás el cobro de ${formatMoney(payment.amount)} (${METHOD_LABEL[payment.method]}) del ${formatDateShort(payment.paid_on)}?`
}

/** One account row's own text (plan, "Front"), never built from a sign
 * comparison: a sale row reads `sale.how_paid`, a payment row names the sale it
 * reached, a credit row always reads "A favor" — all three only through `kind`. */
function rowLabel(row: AccountRow): string {
  if (row.kind === 'sale') {
    return row.sale.how_paid === 'none' ? '' : HOW_PAID_LABEL[row.sale.how_paid]
  }
  if (row.kind === 'payment') {
    return `Cobro · ${METHOD_LABEL[row.payment.method]} · A cuenta de la venta del ${formatDateShort(row.applied_to.sale_date)}`
  }
  return 'A favor'
}

function rowAmount(row: AccountRow): string {
  return row.standing === 'credit'
    ? `A favor ${formatMoneyMagnitude(row.running_balance)}`
    : `saldo ${formatMoney(row.running_balance)}`
}

/** The row's own figure (design, `ClienteFicha.dc.html`: each row shows its own
 * amount — a sale's `total`, a payment's own `applied_to.amount`, a credit's own
 * leftover `amount` — next to, never instead of, the running balance `rowAmount`
 * reads below it. Which field to read comes only from `kind`, never a sign on a
 * number (plan, invariants). */
function rowOwnAmount(row: AccountRow): string {
  if (row.kind === 'sale') return formatMoney(row.sale.total)
  if (row.kind === 'payment') return formatMoney(row.applied_to.amount)
  return formatMoneyMagnitude(row.amount)
}

export interface ClienteFichaProps {
  /** The payment route: the card with "Registrar cobro" open over it. */
  payment?: boolean
}

export default function ClienteFicha({ payment = false }: ClienteFichaProps) {
  const { id } = useParams<{ id: string }>()
  const customerId = id ?? ''
  const location = useLocation()
  const goneShown = useGoneNotice()
  const feedback = readFeedback(location.state) ?? (goneShown ? { kind: 'notice' as const, message: GONE_NOTICE } : null)
  const queryClient = useQueryClient()
  const me = useOutletContext<Me>()
  const vipCustomers = useIsVipCustomers()

  const [deletedToast, setDeletedToast] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState<
    { id: number; amount: number; method: PaymentMethod; paid_on: string } | null
  >(null)
  const [accountGone, setAccountGone] = useState(false)
  const [deletePaymentOffline, setDeletePaymentOffline] = useState(false)
  const [deletePaymentFailed, setDeletePaymentFailed] = useState(false)

  const { data, error, isPending, isError } = useQuery({
    queryKey: keys.customer(customerId),
    queryFn: () => getCustomer(customerId),
  })

  const account = useQuery({
    queryKey: keys.customerAccount(customerId),
    queryFn: () => getAccount(customerId),
    enabled: data !== undefined,
  })

  const removePayment = useMutation({
    mutationFn: (paymentId: number) => deletePayment(String(paymentId)),
  })

  async function onConfirmDeletePayment(): Promise<void> {
    if (confirmingDelete === null) return
    const paymentId = confirmingDelete.id
    setConfirmingDelete(null)
    setDeletePaymentOffline(false)
    setDeletePaymentFailed(false)
    try {
      await removePayment.mutateAsync(paymentId)
      invalidateResource(queryClient, 'payments')
      setDeletedToast(true)
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === PAYMENT_NOT_FOUND) {
        setAccountGone(true)
        invalidateResource(queryClient, 'payments', { refetchType: 'none' })
      } else if (caught instanceof NetworkError) {
        setDeletePaymentOffline(true)
      } else {
        // Any other refusal (`payment.on_the_spot`, once `payments-api` answers
        // it, included) or an unexpected status: the seller must still see that
        // the payment was *not* deleted, never silence — `ErrorGenerico` is the
        // same generic retry every other screen's delete falls back to.
        setDeletePaymentFailed(true)
      }
    }
  }

  if (isError) {
    if (error instanceof ApiError && isGone(error.code)) {
      return <GoneScreen label="Clientes" to={CUSTOMERS} />
    }
    if (error instanceof NetworkError) {
      return (
        <main className="pantalla">
          <div className="cuerpo">
            <SinConexion />
          </div>
        </main>
      )
    }
    return (
      <main className="pantalla">
        <div className="cuerpo">
          <ErrorGenerico />
        </div>
      </main>
    )
  }

  if (isPending || data === undefined) {
    return (
      <main className="pantalla">
        <div className="cuerpo">
          <Loading />
        </div>
      </main>
    )
  }

  const seenPaymentIds = new Set<number>()

  return (
    <main className="pantalla">
      <div className="cuerpo">
        <div>
          <span className="encabezado__titulo">{data.name}</span>
          <InAppLink to={pathTo(CUSTOMER_EDIT, { id: customerId })}>
            Editar
          </InAppLink>
        </div>
        {feedback !== null && <Notice kind={feedback.kind} message={feedback.message} />}
        {accountGone && <Notice kind="notice" message={GONE_NOTICE} />}
        {deletedToast && (
          <div className="toast" role="status">
            <span className="toast__texto">Cobro eliminado</span>
          </div>
        )}
        {deletePaymentOffline && <SinConexion />}
        {deletePaymentFailed && <ErrorGenerico />}

        {data.standing === 'owes' && (
          <div className="campo">
            <span className="cifra-m monto-deuda">Te debe {formatMoney(data.balance)}</span>
            {data.owing_since !== null && (
              <span className="rotulo">desde el {formatDateShort(data.owing_since)}</span>
            )}
          </div>
        )}
        {data.standing === 'credit' && (
          <div className="campo">
            <span className="cifra-m monto-credito">A favor {formatMoneyMagnitude(data.balance)}</span>
          </div>
        )}

        <div className="formulario">
          {data.phone !== null && (
            <div className="campo">
              <span className="campo__rotulo">Teléfono</span>
              <span>{formatPhone(data.phone)}</span>
            </div>
          )}
          <div className="campo">
            <span className="campo__rotulo">Canal</span>
            <span>{data.channel !== null ? CHANNEL_LABEL[data.channel] : 'Sin canal'}</span>
          </div>
          {vipCustomers && (
            <div className="campo">
              <span className="campo__rotulo">VIP</span>
              <span>{data.vip ? 'Sí' : 'No'}</span>
            </div>
          )}
        </div>

        {data.standing === 'owes' && (
          <InAppLink to={pathTo(CUSTOMER_PAYMENT, { id: customerId })} className="boton">
            Registrar cobro
          </InAppLink>
        )}

        <div className="cuenta-cliente">
          {(account.data?.rows ?? []).map((row, index) => {
            const label = rowLabel(row)
            const showDelete =
              row.kind === 'payment' && !seenPaymentIds.has(row.payment.id)
            if (row.kind === 'payment') seenPaymentIds.add(row.payment.id)
            return (
              <div key={index} className="cuenta-cliente__fila">
                <span className="cuenta-cliente__fecha">{formatDateShort(row.date)}</span>
                {label !== '' && <span>{label}</span>}
                <span className="cuenta-cliente__monto">{rowOwnAmount(row)}</span>
                <span className="cuenta-cliente__saldo">{rowAmount(row)}</span>
                {showDelete && (
                  <button
                    type="button"
                    className="boton-enlace"
                    onClick={() =>
                      setConfirmingDelete({
                        id: row.payment.id,
                        amount: row.payment.amount,
                        method: row.payment.method,
                        paid_on: row.payment.paid_on,
                      })
                    }
                  >
                    Borrar cobro
                  </button>
                )}
              </div>
            )
          })}
        </div>

        <InAppLink to={SALE_NEW} state={newSaleFor(customerId)} className="boton">
          Nueva venta a {data.name}
        </InAppLink>
      </div>

      {payment && <Cobro customerId={customerId} balance={data.balance} today={me.today} />}

      {confirmingDelete !== null && (
        <ConfirmDialog
          title={deletePaymentTitle(confirmingDelete)}
          detail="Esto no se puede deshacer."
          confirmText="Sí, borralo"
          cancelText="No, dejalo"
          onConfirm={() => void onConfirmDeletePayment()}
          onCancel={() => setConfirmingDelete(null)}
        />
      )}
    </main>
  )
}
