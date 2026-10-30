/**
 * `ClienteFicha`: a customer's card — phone, VIP, the balance and
 * "Registrar cobro" (`payments.md`, "En pantalla"). Every figure here —
 * `balance`, `owing_since`, `standing`, the account's rows and their own
 * `running_balance`/`standing` — is the payments domain's own answer
 * (`settle()`), never computed here (plan, invariants): this screen only reads
 * `standing` (or a row's `kind`) to choose a label, never a sign on `balance` or
 * `running_balance`. A `gone` answer (another business's id, or an old link)
 * shows `GoneScreen`, never a 403 or a hint that a record exists somewhere else
 * (ADR-0004).
 */

import { CUSTOMERS, CUSTOMER_EDIT, SALE_NEW, paymentLink, pathTo } from '../../routes'
import { useRef, useState } from 'react'
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
  type PaymentMethod,
  deletePayment,
  getAccount,
} from '../../api/payments'
import { GONE_NOTICE, isGone } from '../../api/refusals'
import { useReturnToPlace } from '../../components/useReturnToPlace'

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
import AccountRowLine from './AccountRowLine'
import { METHOD_LABEL, deleteRowIndices, rowKey } from './accountRows'
import { COMMON_TEXT } from '../../copy/common'
import { CUSTOMERS_TEXT } from '../../copy/customers'

function deletePaymentTitle(payment: { amount: number; method: PaymentMethod; paid_on: string }): string {
  return CUSTOMERS_TEXT.deletePaymentOf(formatMoney(payment.amount), METHOD_LABEL[payment.method], formatDateShort(payment.paid_on))
}

function cardHeading(root: HTMLElement): HTMLElement | null {
  return root.querySelector<HTMLElement>('[data-place="card-heading"]')
}

export default function ClienteFicha() {
  const { id } = useParams<{ id: string }>()
  const customerId = id ?? ''
  const location = useLocation()
  const goneShown = useGoneNotice()
  const feedback = readFeedback(location.state) ?? (goneShown ? { kind: 'notice' as const, refusal: GONE_NOTICE } : null)
  const queryClient = useQueryClient()
  const vipCustomers = useIsVipCustomers()

  const [deletedToast, setDeletedToast] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState<
    { id: number; amount: number; method: PaymentMethod; paid_on: string } | null
  >(null)
  const [accountGone, setAccountGone] = useState(false)
  const [deletePaymentOffline, setDeletePaymentOffline] = useState(false)
  const [deletePaymentFailed, setDeletePaymentFailed] = useState(false)

  const { data, error, isPending, isError, isFetching } = useQuery({
    queryKey: keys.customer(customerId),
    queryFn: () => getCustomer(customerId),
  })

  const account = useQuery({
    queryKey: keys.customerAccount(customerId),
    queryFn: () => getAccount(customerId),
    enabled: data !== undefined,
  })

  // Back from Record payment the card returns to its place (PM option a): "Record payment" gets
  // focus, or the card's heading when the balance is paid and the control is gone. The place is
  // taken up once the account has answered too: it is the long part of the card, and a page still
  // short of it would clamp the offset.
  const root = useRef<HTMLElement>(null)
  const accountAnswered = account.isError || (account.data !== undefined && !account.isFetching)
  useReturnToPlace({
    root,
    ready: data !== undefined && !isFetching && accountAnswered,
    customerId,
    fallback: cardHeading,
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
      return <GoneScreen label={COMMON_TEXT.customers} to={CUSTOMERS} />
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
    <main className="pantalla" ref={root}>
      <div className="cuerpo">
        <div className="ficha-cliente__encabezado">
          <span className="encabezado__titulo" tabIndex={-1} data-place="card-heading">{data.name}</span>
          <BotonLink variant="icon" action="edit" ariaLabel={COMMON_TEXT.edit} to={pathTo(CUSTOMER_EDIT, { id: customerId })} />
        </div>
        {feedback !== null && <Notice {...feedback} />}
        {accountGone && <Notice kind="notice" refusal={GONE_NOTICE} />}
        {deletedToast && (
          <div className="toast" role="status">
            <span className="toast__texto">{CUSTOMERS_TEXT.paymentDeleted}</span>
          </div>
        )}
        {deletePaymentOffline && <SinConexion />}
        {deletePaymentFailed && <ErrorGenerico />}

        {data.standing === 'owes' && (
          <div className="ficha-deuda">
            <span className="rotulo ficha-deuda__rotulo">{CUSTOMERS_TEXT.owesYou}</span>
            <span className="cifra-l monto-deuda">{formatMoney(data.balance)}</span>
            {data.owing_since !== null && (
              <span className="rotulo">{CUSTOMERS_TEXT.since}{formatDateShort(data.owing_since)}</span>
            )}
            <div className="clientes__accion">
              <BotonLink {...paymentLink(customerId, 'card')} icon="cobro">
                {COMMON_TEXT.recordPayment}
              </BotonLink>
            </div>
          </div>
        )}
        {data.standing === 'credit' && (
          <div className="ficha-deuda ficha-deuda--credito">
            <span className="rotulo ficha-deuda__rotulo">{CUSTOMERS_TEXT.creditLabel}</span>
            <span className="cifra-l monto-credito">{formatMoneyMagnitude(data.balance)}</span>
          </div>
        )}

        <div className="formulario">
          {data.phone !== null && (
            <div className="campo">
              <span className="campo__rotulo">{CUSTOMERS_TEXT.phone}</span>
              <span>{formatPhone(data.phone)}</span>
            </div>
          )}
          {vipCustomers && (
            <div className="campo">
              <span className="campo__rotulo">{COMMON_TEXT.vip}</span>
              <span>{data.vip ? CUSTOMERS_TEXT.yes : CUSTOMERS_TEXT.off}</span>
            </div>
          )}
        </div>

        <section className="cuenta-cliente" aria-labelledby="cuenta-cliente-titulo">
          <h2 id="cuenta-cliente-titulo" className="rotulo cuenta-cliente__encabezado">
            {CUSTOMERS_TEXT.accountHeading}
          </h2>
          {rows.map((row, index) => (
            <AccountRowLine key={rowKey(row)} row={row}>
              {deleteIndices.has(index) && row.kind !== 'sale' && (
                <Boton
                  variant="icon"
                  action="delete"
                  ariaLabel={CUSTOMERS_TEXT.deletePayment}
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
            </AccountRowLine>
          ))}
        </section>

        <div className="ficha-cliente__pie">
          <BotonLink to={SALE_NEW} state={newSaleFor(customerId)} icon="agregar">
            <span className="ficha-cliente__pie-texto">{CUSTOMERS_TEXT.newSaleTo}{data.name}</span>
          </BotonLink>
        </div>
      </div>

      {confirmingDelete !== null && (
        <ConfirmDialog
          title={deletePaymentTitle(confirmingDelete)}
          detail={COMMON_TEXT.cannotUndo}
          confirmText={COMMON_TEXT.yesDelete}
          cancelText={COMMON_TEXT.noKeep}
          onConfirm={() => void onConfirmDeletePayment()}
          onCancel={() => setConfirmingDelete(null)}
        />
      )}
    </main>
  )
}
