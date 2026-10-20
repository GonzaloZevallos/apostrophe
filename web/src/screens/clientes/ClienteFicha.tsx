/**
 * `ClienteFicha`: a customer's card — phone, VIP, the balance and
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
import { useLocation, useParams } from 'react-router'
import Boton from '../../components/Boton'
import BotonLink from '../../components/BotonLink'
import { useGoneNotice } from '../../components/goneExit'
import { ApiError, NetworkError } from '../../api/client'
import { getCustomer } from '../../api/customers'
import { invalidateResource, keys } from '../../api/keys'
import { useIsVipCustomers } from '../../api/pricingSettings'
import {
  type AccountRow,
  type HowPaid,
  type PaymentMethod,
  deletePayment,
  getAccount,
} from '../../api/payments'
import { RULE_VIP } from '../../copy/common'
import {
  CANCEL_DELETE,
  CONFIRM_DELETE,
  CREDIT,
  DELETE_DETAIL,
  DELETE_PAYMENT,
  EDIT,
  HOW_PAID_CASH,
  HOW_PAID_OWING,
  HOW_PAID_TRANSFER,
  METHOD_CASH,
  METHOD_TRANSFER,
  NO,
  PAYMENT_DELETED,
  PHONE,
  RECORD_PAYMENT,
  YES,
  balanceOf,
  creditOf,
  deletePaymentQuestion,
  newSaleTo,
  owes,
  paymentRow,
} from '../../copy/customers'
import { sinceDate } from '../../copy/format'
import { GONE_NOTICE } from '../../copy/refusals'
import { TAB_CUSTOMERS } from '../../copy/shell'
import { isGone } from '../../api/refusals'

// `payment.not_found` is not yet in `contract.json` (`isGone` would answer
// `false` for it): that code's own `kind: "gone"` entry ships with the
// `payments-api` subtask's diff, the same diff that answers it (plan,
// invariants: a refusal's code and its `contract.json` entry land together).
// Checked here by its literal string, not through the shared, contract-backed
// `isGone`, until that lands.
const PAYMENT_NOT_FOUND_CODE = 'payment.not_found'
const PAYMENTS_RESOURCE_KEY = 'payments'
const NO_REFETCH_OPTIONS = { refetchType: 'none' } as const
const SALE_ROW_KEY_PREFIX = 'sale-'
const PAYMENT_ROW_KEY_PREFIX = 'payment-'
const CREDIT_ROW_KEY_PREFIX = 'credit-'
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
import { deleteRowIndices } from './accountRows'

const HOW_PAID_LABEL: Record<Exclude<HowPaid, 'none'>, string> = {
  cash: HOW_PAID_CASH,
  transfer: HOW_PAID_TRANSFER,
  owing: HOW_PAID_OWING,
}

const METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: METHOD_CASH,
  transfer: METHOD_TRANSFER,
}

function deletePaymentTitle(payment: { amount: number; method: PaymentMethod; paid_on: string }): string {
  return deletePaymentQuestion(
    formatMoney(payment.amount),
    METHOD_LABEL[payment.method],
    formatDateShort(payment.paid_on),
  )
}

/** One account row's own text (plan, "Front"), never built from a sign
 * comparison: a sale row reads `sale.how_paid`, a payment row names the sale it
 * reached, a credit row always reads "A favor" — all three only through `kind`. */
function rowLabel(row: AccountRow): string {
  if (row.kind === 'sale') {
    return row.sale.how_paid === 'none' ? '' : HOW_PAID_LABEL[row.sale.how_paid]
  }
  if (row.kind === 'payment') {
    return paymentRow(METHOD_LABEL[row.payment.method], formatDateShort(row.applied_to.sale_date))
  }
  return CREDIT
}

function rowAmount(row: AccountRow): string {
  return row.standing === 'credit'
    ? creditOf(formatMoneyMagnitude(row.running_balance))
    : balanceOf(formatMoney(row.running_balance))
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

/** A row's React key, from the ids its own kind carries (never its index). A
 * payment settles a given sale in at most one split, so `payment`+`sale` is unique. */
function rowKey(row: AccountRow): string {
  if (row.kind === 'sale') return `${SALE_ROW_KEY_PREFIX}${row.sale.id}`
  if (row.kind === 'payment') return `${PAYMENT_ROW_KEY_PREFIX}${row.payment.id}-${row.applied_to.sale_id}`
  return `${CREDIT_ROW_KEY_PREFIX}${row.payment.id}`
}

export default function ClienteFicha() {
  const { id } = useParams<{ id: string }>()
  const customerId = id ?? ''
  const location = useLocation()
  const goneShown = useGoneNotice()
  const feedback = readFeedback(location.state) ?? (goneShown ? { kind: 'notice' as const, message: GONE_NOTICE } : null)
  const queryClient = useQueryClient()
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
      invalidateResource(queryClient, PAYMENTS_RESOURCE_KEY)
      setDeletedToast(true)
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === PAYMENT_NOT_FOUND_CODE) {
        setAccountGone(true)
        invalidateResource(queryClient, PAYMENTS_RESOURCE_KEY, NO_REFETCH_OPTIONS)
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
      return <GoneScreen label={TAB_CUSTOMERS} to={CUSTOMERS} />
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

  const rows = account.data?.rows ?? []
  const deleteIndices = deleteRowIndices(rows)

  return (
    <main className="pantalla">
      <div className="cuerpo">
        <div className="ficha-cliente__encabezado">
          <span className="encabezado__titulo">{data.name}</span>
          <BotonLink variant="icon" action="edit" ariaLabel={EDIT} to={pathTo(CUSTOMER_EDIT, { id: customerId })} />
        </div>
        {feedback !== null && <Notice kind={feedback.kind} message={feedback.message} />}
        {accountGone && <Notice kind="notice" message={GONE_NOTICE} />}
        {deletedToast && (
          <div className="toast" role="status">
            <span className="toast__texto">{PAYMENT_DELETED}</span>
          </div>
        )}
        {deletePaymentOffline && <SinConexion />}
        {deletePaymentFailed && <ErrorGenerico />}

        {data.standing === 'owes' && (
          <div className="ficha-deuda">
            <span className="cifra-m monto-deuda">{owes(formatMoney(data.balance))}</span>
            {data.owing_since !== null && (
              <span className="rotulo">{sinceDate(formatDateShort(data.owing_since))}</span>
            )}
            <div className="clientes__accion">
              <BotonLink to={pathTo(CUSTOMER_PAYMENT, { id: customerId })} icon="cobro">
                {RECORD_PAYMENT}
              </BotonLink>
            </div>
          </div>
        )}
        {data.standing === 'credit' && (
          <div className="campo">
            <span className="cifra-m monto-credito">{creditOf(formatMoneyMagnitude(data.balance))}</span>
          </div>
        )}

        <div className="formulario">
          {data.phone !== null && (
            <div className="campo">
              <span className="campo__rotulo">{PHONE}</span>
              <span>{formatPhone(data.phone)}</span>
            </div>
          )}
          {vipCustomers && (
            <div className="campo">
              <span className="campo__rotulo">{RULE_VIP}</span>
              <span>{data.vip ? YES : NO}</span>
            </div>
          )}
        </div>

        <div className="cuenta-cliente">
          {rows.map((row, index) => {
            const label = rowLabel(row)
            return (
              <div key={rowKey(row)} className="cuenta-cliente__fila">
                <span className="cuenta-cliente__fecha">{formatDateShort(row.date)}</span>
                {label !== '' && <span className="cuenta-cliente__etiqueta">{label}</span>}
                <span className="cuenta-cliente__monto">{rowOwnAmount(row)}</span>
                <span className="cuenta-cliente__saldo">{rowAmount(row)}</span>
                {deleteIndices.has(index) && row.kind !== 'sale' && (
                  <Boton
                    variant="icon"
                    action="delete"
                    ariaLabel={DELETE_PAYMENT}
                    onClick={() =>
                      setConfirmingDelete({
                        id: row.payment.id,
                        amount: row.payment.amount,
                        method: row.payment.method,
                        paid_on: row.payment.paid_on,
                      })
                    }
                  />
                )}
              </div>
            )
          })}
        </div>

        <div className="clientes__accion">
          <BotonLink to={SALE_NEW} state={newSaleFor(customerId)} icon="agregar">
            {newSaleTo(data.name)}
          </BotonLink>
        </div>
      </div>

      {confirmingDelete !== null && (
        <ConfirmDialog
          title={deletePaymentTitle(confirmingDelete)}
          detail={DELETE_DETAIL}
          confirmText={CONFIRM_DELETE}
          cancelText={CANCEL_DELETE}
          onConfirm={() => void onConfirmDeletePayment()}
          onCancel={() => setConfirmingDelete(null)}
        />
      )}
    </main>
  )
}
