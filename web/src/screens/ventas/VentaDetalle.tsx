/**
 * `VentaDetalle` (`sales.md`, "On screen: Detalle de venta"; `VentaDetalle.dc.html`), one layout
 * for phone and computer: the title row "Sale #N" with the one Share, `SaleCustomerCard` (who,
 * when, the payment chip), `SaleDetailCard` (the lines, shipping, Total and note), the toasts and
 * errors, the Sale bill's Copy and the Void row, all from the API's own answer (docs/adr/0011;
 * plan, invariants: nothing here is the preview). `useSaleBillShare` is called once, here, before
 * the error and pending returns: the title row's Share calls `share.onTap`, the block copies
 * through `share.onCopy`. A line's cost of goods and pending cost (`SaleDetailLine.cost`) answer
 * in the API but are left out here, as they were before this rebuild.
 * "Borrás
 * la venta" is confirmed
 * with `Antes de borrar`, naming the date and the amount; "Venta guardada" with
 * Deshacer (`Estados`) is this screen's own banner, read once through
 * `readFeedback`/`clearSaleJustSaved` and cleared from history state so a refresh
 * or Back never resurrects it. "Asignar cliente" (`assign-customer`) shows only
 * when `sale.customer` is `null`, never to change one: it opens the same "Elegir
 * cliente" sheet `NuevaVenta` uses (`NuevaVentaCliente`), with `allowNone={false}`
 * so "Sin cliente" never shows here (PM round 4). On success the toast "Cliente
 * asignado" shows in place — no navigation, so it is a local `AvisoExito`, not a
 * history-state toast. If a partner assigned one first, `sale.customer_already_assigned`
 * shows its own fixed message (through `RefusalCode`/`resolveOverride`, like every
 * other screen's refusal handling) and the detail is invalidated so it refreshes
 * with the customer now on it; lines are never repriced (PRD, "Detalle de venta").
 * A gone answer on the assign itself — the sale or the chosen customer deleted
 * meanwhile (`sale.not_found`, `sale.customer_not_found`) — follows the same gone
 * path `removeSale` already takes: `GONE_NOTICE` on `Ventas` (PRD: "assigning a
 * customer, deleting or undoing shows 'Eso ya no está. La lista ya está al día.'").
 */

import { SALES } from '../../routes'
import { useEffect, useId, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate, useParams } from 'react-router'
import { ApiError, NetworkError } from '../../api/client'
import type { Customer } from '../../api/customers'
import { invalidateResource, keys } from '../../api/keys'
import { assignCustomer, deleteSale, getSale, type SaleDetail } from '../../api/sales'
import { isGone, resolveOverride, type RefusalCode } from '../../api/refusals'
import AvisoExito from '../../components/AvisoExito'
import Boton from '../../components/Boton'
import ConfirmDialog from '../../components/ConfirmDialog'
import { clearSaleJustSaved, gone, readFeedback, SALE_SAVED, toast } from '../../components/feedback'
import ErrorGenerico from '../../components/ErrorGenerico'
import GoneScreen from '../../components/GoneScreen'
import SinConexion from '../../components/SinConexion'
import Loading from '../../components/Loading'
import { SheetStackProvider, useSheet } from '../../components/useSheetStack'
import { formatDateShort } from '../../format/dates'
import { formatGrams, type MoneyFormatter } from '../../format/money'
import { useMoney } from '../../format/moneyContext'
import { GENERIC_REFUSAL } from './NuevaVenta'
import NuevaVentaCliente from './NuevaVentaCliente'
import SaleBillButton from './SaleBillButton'
import SaleCustomerCard from './SaleCustomerCard'
import SaleDetailCard from './SaleDetailCard'
import { COMMON_TEXT } from '../../copy/common'
import { SALES_TEXT } from '../../copy/sales'
import { useSaleBillShare } from '../../sales/useSaleBillShare'
import ContentArea from '../../components/ContentArea'

export const CUSTOMER_ALREADY_ASSIGNED_MESSAGE = SALES_TEXT.saleHasCustomer
const ASSIGN_TOAST_MS = 2500

/** `PUT /sales/{id}/customer`'s own refusals, matched only through `RefusalCode`
 * (plan, invariants: "screens reference codes only through RefusalCode"), never a
 * bare string comparison. `refetch` is set only for the one code whose refusal
 * means another customer is already on the sale: the detail must then show who,
 * not the stale "no customer" this screen last rendered. */
const ASSIGN_OVERRIDES: Partial<Record<RefusalCode, { message: string; refetch: boolean }>> = {
  'sale.customer_already_assigned': { message: CUSTOMER_ALREADY_ASSIGNED_MESSAGE, refetch: true },
}

export const UNDO_WINDOW_MS = 5000

function deleteTitle(sale: SaleDetail, money: MoneyFormatter): string {
  const total = money.money(sale.total)
  const day = formatDateShort(sale.date)
  const grams = formatGrams(sale.total_quantity)
  return SALES_TEXT.deleteSaleConfirm(total, day, grams)
}

const DELETE_TOAST = 'common:saleDeleted'
const UNDO_TOAST = 'common:saleDeletedGramsBack'

/** One sheet stack per screen (ADR-0027): Asignar cliente is level 1, Nuevo cliente level 2. */
export default function VentaDetalle() {
  return (
    <SheetStackProvider>
      <VentaDetalleScreen />
    </SheetStackProvider>
  )
}

function VentaDetalleScreen() {
  const money = useMoney()
  const { id } = useParams<{ id: string }>()
  const saleId = id ?? ''
  const location = useLocation()
  const { t, i18n } = useTranslation()
  const titleId = useId()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [feedback] = useState(() => readFeedback(location.state))
  const justSaved = feedback?.kind === 'saved'
  const [undoAvailable, setUndoAvailable] = useState(justSaved)

  useEffect(() => {
    // `justSaved` is fixed for this mount (plain `useState` lazy init above), so
    // this clears the marker exactly once, never on a later render.
    if (!justSaved) return
    navigate(location.pathname, { replace: true, state: clearSaleJustSaved() })
  }, [justSaved, location.pathname, navigate])

  useEffect(() => {
    if (!undoAvailable) return
    const timer = setTimeout(() => setUndoAvailable(false), UNDO_WINDOW_MS)
    return () => clearTimeout(timer)
  }, [undoAvailable])

  const { data, error, isPending, isError } = useQuery({
    queryKey: keys.sale(saleId),
    queryFn: () => getSale(saleId),
  })

  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteOffline, setDeleteOffline] = useState(false)
  const [deleteFailed, setDeleteFailed] = useState(false)

  const assignSheet = useSheet(1)
  const [assignError, setAssignError] = useState<string | null>(null)
  const [assignOffline, setAssignOffline] = useState(false)
  // One notice slot: "Customer assigned" and "Bill copied" share the one `AvisoExito` and timer.
  const [notice, setNotice] = useState<'assigned' | 'copied' | null>(null)
  // After a successful PUT the detail is read again; the sale bill stays busy until the loaded
  // detail shows the customer (never a timestamp: a focus refetch that began before the PUT can
  // still answer the detail from before it).
  const [awaitingAssigned, setAwaitingAssigned] = useState(false)

  const assignMutation = useMutation({
    mutationFn: (customerId: number) => assignCustomer(saleId, customerId),
  })

  useEffect(() => {
    if (notice === null) return
    const timer = setTimeout(() => setNotice(null), ASSIGN_TOAST_MS)
    return () => clearTimeout(timer)
  }, [notice])

  const assignedCustomerArrived = data !== undefined && data.customer !== null
  // Derived while rendering, not in an effect: the wait ends the render the detail shows the
  // customer, or the query errors.
  if (awaitingAssigned && (isError || assignedCustomerArrived)) setAwaitingAssigned(false)

  // The one share of the screen, called before the error and pending returns: the title row taps
  // `onTap`, the block taps `onCopy`.
  const share = useSaleBillShare({
    state: data === undefined ? { kind: 'loading' } : { kind: 'ready', bill: data.bill },
    refreshing: assignMutation.isPending || (awaitingAssigned && data?.customer === null),
    onCopied: () => setNotice('copied'),
  })

  async function onCustomerChosen(customer: Customer | null): Promise<void> {
    if (customer === null) return // `allowNone={false}`: the sheet never offers it here.
    setAssignError(null)
    setAssignOffline(false)
    try {
      await assignMutation.mutateAsync(customer.id)
      // The detail is read back from `GET /sales/{id}`, never rebuilt from the PUT's
      // answer: the sale bill's balance comes from the settlement pass only that read
      // runs (ADR-0053), and the PUT's `SaleOut` carries no bill and no line cost
      // (ADR-0009). `keys.sale(saleId)` shares the `sales` prefix, so this refetches it.
      setAwaitingAssigned(true)
      invalidateResource(queryClient, 'sales')
      setNotice('assigned')
    } catch (caught) {
      if (caught instanceof ApiError && isGone(caught.code)) {
        // The sale, or the customer just chosen, is gone (a partner deleted
        // either meanwhile): the same gone path `removeSale` takes below.
        // `refetchType: 'none'`: this screen's own `keys.sale(saleId)` query is
        // still mounted for one more tick and would otherwise refetch into a 404
        // the browser logs on its own (keys.ts).
        invalidateResource(queryClient, 'sales', { refetchType: 'none' })
        navigate(SALES, { replace: true, state: gone() })
      } else if (caught instanceof ApiError) {
        const override = resolveOverride(ASSIGN_OVERRIDES, caught.code)
        setAssignError(override?.message ?? GENERIC_REFUSAL)
        if (override?.refetch === true) {
          void queryClient.invalidateQueries({ queryKey: keys.sale(saleId) })
        }
      } else if (caught instanceof NetworkError) {
        setAssignOffline(true)
      } else {
        setAssignError(GENERIC_REFUSAL)
      }
    }
  }

  async function removeSale(reason: 'borrar' | 'deshacer'): Promise<void> {
    setDeleting(true)
    setDeleteOffline(false)
    setDeleteFailed(false)
    try {
      await deleteSale(saleId)
      // `refetchType: 'none'` (keys.ts): the sale just deleted is this screen's own
      // `keys.sale(saleId)`, still mounted for one more tick — refetching it now
      // would only answer 404. Ventas still gets a fresh list on its next mount,
      // since the invalidated query is left stale.
      invalidateResource(queryClient, 'sales', { refetchType: 'none' })
      // Deshacer's own toast names the grams going back to stock (sales.md, PM
      // adjustment 4); the explicit "Borrar venta" confirmation already named them
      // in its question, so its toast stays the plain, existing one.
      navigate(SALES, {
        replace: true,
        state: toast(reason === 'deshacer' ? UNDO_TOAST : DELETE_TOAST),
      })
    } catch (caught) {
      if (caught instanceof ApiError && isGone(caught.code)) {
        invalidateResource(queryClient, 'sales', { refetchType: 'none' })
        navigate(SALES, { replace: true, state: gone() })
      } else if (caught instanceof NetworkError) {
        setDeleteOffline(true)
      } else {
        setDeleteFailed(true)
      }
    } finally {
      setDeleting(false)
      setConfirmingDelete(false)
    }
  }

  if (isError) {
    if (error instanceof ApiError && isGone(error.code)) {
      return <GoneScreen label={COMMON_TEXT.sales} to={SALES} />
    }
    if (error instanceof NetworkError) {
      return (
        <ContentArea as="main" className="pantalla">
          <div className="cuerpo">
            <SinConexion />
          </div>
        </ContentArea>
      )
    }
    return (
      <ContentArea as="main" className="pantalla">
        <div className="cuerpo">
          <ErrorGenerico />
        </div>
      </ContentArea>
    )
  }

  if (isPending || data === undefined) {
    return (
      <ContentArea as="main" className="pantalla">
        <div className="cuerpo">
          <div className="encabezado__fila">
            <span className="encabezado__titulo" />
          </div>
          <Loading />
          <div className="venta-detalle__acciones">
            <SaleBillButton share={share} hasBill />
          </div>
        </div>
      </ContentArea>
    )
  }
  const sale = data
  const refreshing = assignMutation.isPending || (awaitingAssigned && sale.customer === null)

  return (
    <ContentArea as="main" className="pantalla venta-detalle">
      <div className="cuerpo">
        <div className="encabezado-fila" role="group" aria-labelledby={titleId}>
          <h1 id={titleId} className="encabezado__titulo">
            {t('sales:detail.title')}
            {sale.number}
          </h1>
          {share.sharing && sale.bill !== null && (
            <Boton
              variant="icon"
              action="share"
              ariaLabel={t('sales:detail.share')}
              disabled={share.busy}
              ariaBusy={share.busy ? true : undefined}
              onClick={share.onTap}
            />
          )}
        </div>

        {undoAvailable && (
          <div className="venta-guardada" role="status">
            <span className="venta-guardada__texto">{t(SALE_SAVED)}</span>
            <Boton variant="undo" disabled={deleting} onClick={() => void removeSale('deshacer')}>
              {SALES_TEXT.undo}
            </Boton>
          </div>
        )}
        {deleteOffline && <SinConexion />}
        {deleteFailed && <ErrorGenerico />}

        <SaleCustomerCard
          customerName={sale.customer?.name ?? null}
          date={sale.date}
          language={i18n.language}
          paymentState={sale.payment_state}
          stillOwed={sale.still_owed}
          methodName={sale.payment_method?.name ?? null}
          onAssign={sale.customer === null ? assignSheet.open : undefined}
          assignDisabled={refreshing}
        />

        <SaleDetailCard
          lines={sale.lines}
          shipping_charged={sale.shipping_charged}
          total={sale.total}
          note={sale.note}
        />

        {notice === 'assigned' && <AvisoExito texto={SALES_TEXT.customerAssigned} />}
        {notice === 'copied' && <AvisoExito texto={t('sales:bill.copied')} />}
        {assignOffline && <SinConexion />}
        {assignError !== null && (
          <span className="campo__error" role="alert">
            {assignError}
          </span>
        )}

        <div className="venta-detalle__acciones">
          <SaleBillButton share={share} hasBill={sale.bill !== null} />
        </div>

        <div className="venta-detalle__botones">
          <Boton variant="secondary" icon="tacho" onClick={() => setConfirmingDelete(true)}>
            {t('sales:detail.void')}
          </Boton>
        </div>
      </div>

      {assignSheet.isOpen && (
        <NuevaVentaCliente allowNone={false} onChosen={(customer) => void onCustomerChosen(customer)} />
      )}

      {confirmingDelete && (
        <ConfirmDialog
          title={deleteTitle(sale, money)}
          detail={COMMON_TEXT.cannotUndo}
          confirmText={t('sales:detail.yesVoid')}
          cancelText={COMMON_TEXT.noKeep}
          onConfirm={() => {
            if (!deleting) void removeSale('borrar')
          }}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
    </ContentArea>
  )
}
