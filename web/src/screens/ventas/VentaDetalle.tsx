/**
 * `VentaDetalle` (`sales.md`, "On screen: Detalle de venta"; `VentaDetalle.dc.html`):
 * the title with the sale's date, the total, a summary line of grams (the API's
 * `total_grams`, never summed here) · the customer or "Sin cliente" · how it was
 * paid (`paymentSummary`, dropping `payment: 'none'`'s part), each line with its
 * price per gram, `ReglaInsignia` and line total, shipping, a final Total row and
 * the note — all from the API's own answer (docs/adr/0011; plan, invariants:
 * nothing here is the preview). A line's cost of goods and pending cost
 * (`SaleDetailLine.cost`) answer in the API but are left out here, as they were
 * before this rebuild: neither `VentaDetalle.dc.html` nor sales.md's "Shows" list
 * names them. The VIP mark this screen once showed next to the customer's name is
 * dropped too: the design's summary is one flat text line, and sales.md's "Shows"
 * names only "the customer or Sin cliente" (plan, invariants: no figure or text the
 * API does not answer, and no behaviour sales.md lacks, appears on screen). "Borrás
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

import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocation, useNavigate, useParams } from 'react-router'
import { ApiError, NetworkError } from '../../api/client'
import type { Customer } from '../../api/customers'
import { invalidateResource, keys } from '../../api/keys'
import { assignCustomer, deleteSale, getSale, type Sale, type SaleDetail } from '../../api/sales'
import { isGone, resolveOverride, type RefusalCode } from '../../api/refusals'
import AvisoExito from '../../components/AvisoExito'
import Boton from '../../components/Boton'
import ConfirmDialog from '../../components/ConfirmDialog'
import { clearSaleJustSaved, gone, readFeedback, SALE_SAVED, toast } from '../../components/feedback'
import ErrorGenerico from '../../components/ErrorGenerico'
import GoneScreen from '../../components/GoneScreen'
import ReglaInsignia from '../../components/ReglaInsignia'
import SinConexion from '../../components/SinConexion'
import { formatDateShort } from '../../format/dates'
import { formatGrams, formatMoney } from '../../format/money'
import { GENERIC_REFUSAL } from './NuevaVenta'
import NuevaVentaCliente from './NuevaVentaCliente'
import { paths } from '../../routes/paths'

export const CUSTOMER_ALREADY_ASSIGNED_MESSAGE = 'Esta venta ya tiene cliente.'
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

/** How the sale was paid, read only from `payment` (plan, invariants: "how it was
 * paid on the detail comes only from `payment` through `paymentSummary`") — never
 * derived from `still_owing` or an amount. `none` drops its part of the summary
 * line entirely, replacing `PAYMENT_LABEL` and its own row (plan, "sale-detail"). */
function paymentSummary(payment: Sale['payment']): string {
  switch (payment) {
    case 'cash':
      return 'pagada en efectivo'
    case 'transfer':
      return 'pagada por transferencia'
    case 'owing':
      return 'quedó debiendo'
    case 'none':
      return ''
  }
}

/** The design's one summary line under the total (`VentaDetalle.dc.html`):
 * grams · customer or "Sin cliente" · how it was paid, each part from the API's
 * own answer, joined by " · " with `payment: 'none'`'s empty part dropped. */
function summaryLine(sale: SaleDetail): string {
  const parts = [
    formatGrams(sale.total_grams),
    sale.customer === null ? 'Sin cliente' : sale.customer.name,
    paymentSummary(sale.payment),
  ]
  return parts.filter((part) => part !== '').join(' · ')
}

function deleteTitle(sale: SaleDetail): string {
  const money = formatMoney(sale.total)
  const day = formatDateShort(sale.date)
  const grams = formatGrams(sale.total_grams)
  return `¿Borrás la venta de ${money} del ${day}? Vuelven ${grams} al stock.`
}

const DELETE_TOAST = 'Venta eliminada'
const UNDO_TOAST = 'Venta eliminada · los gramos vuelven al stock'

export default function VentaDetalle() {
  const { id } = useParams<{ id: string }>()
  const saleId = id ?? ''
  const location = useLocation()
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

  const [showAssignSheet, setShowAssignSheet] = useState(false)
  const [assignError, setAssignError] = useState<string | null>(null)
  const [assignOffline, setAssignOffline] = useState(false)
  const [assigned, setAssigned] = useState(false)

  const assignMutation = useMutation({
    mutationFn: (customerId: number) => assignCustomer(saleId, customerId),
  })

  useEffect(() => {
    if (!assigned) return
    const timer = setTimeout(() => setAssigned(false), ASSIGN_TOAST_MS)
    return () => clearTimeout(timer)
  }, [assigned])

  async function onCustomerChosen(customer: Customer | null): Promise<void> {
    if (customer === null) return // `allowNone={false}`: the sheet never offers it here.
    setShowAssignSheet(false)
    setAssignError(null)
    setAssignOffline(false)
    try {
      const updated = await assignMutation.mutateAsync(customer.id)
      // The PUT already answers the sale as it now stands (docs/adr/0011): this
      // writes that answer straight into the cache instead of a second `GET`
      // (plan, invariants: what is shown comes from the API's answer). The PUT's
      // `SaleOut` carries no line cost (ADR-0009: only `GET /sales/{id}` allocates
      // one), so each line keeps the cost the detail already read: assigning a
      // customer never touches a line.
      queryClient.setQueryData<SaleDetail>(keys.sale(saleId), (current) =>
        current === undefined
          ? current
          : { ...updated, lines: current.lines, total_grams: current.total_grams },
      )
      invalidateResource(queryClient, 'sales')
      setAssigned(true)
    } catch (caught) {
      if (caught instanceof ApiError && isGone(caught.code)) {
        // The sale, or the customer just chosen, is gone (a partner deleted
        // either meanwhile): the same gone path `removeSale` takes below.
        // `refetchType: 'none'`: this screen's own `keys.sale(saleId)` query is
        // still mounted for one more tick and would otherwise refetch into a 404
        // the browser logs on its own (keys.ts).
        invalidateResource(queryClient, 'sales', { refetchType: 'none' })
        navigate(paths.sales(), { replace: true, state: gone() })
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
      navigate(paths.sales(), {
        replace: true,
        state: toast(reason === 'deshacer' ? UNDO_TOAST : DELETE_TOAST),
      })
    } catch (caught) {
      if (caught instanceof ApiError && isGone(caught.code)) {
        invalidateResource(queryClient, 'sales', { refetchType: 'none' })
        navigate(paths.sales(), { replace: true, state: gone() })
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
      return <GoneScreen label="Ventas" to={paths.sales()} />
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

  if (isPending || data === undefined) return null
  const sale = data

  return (
    <main className="pantalla">
      <div className="cuerpo">
        <div className="encabezado__fila">
          <span className="encabezado__titulo">{`Venta del ${formatDateShort(sale.date)}`}</span>
        </div>

        {undoAvailable && (
          <div className="venta-guardada" role="status">
            <span className="venta-guardada__texto">{SALE_SAVED}</span>
            <button
              type="button"
              className="venta-guardada__deshacer"
              disabled={deleting}
              onClick={() => void removeSale('deshacer')}
            >
              Deshacer
            </button>
          </div>
        )}
        {deleteOffline && <SinConexion />}
        {deleteFailed && <ErrorGenerico />}

        <div className="venta-detalle__resumen">
          <span className="campo__rotulo">Total</span>
          <span className="cifra-xl">{formatMoney(sale.total)}</span>
          <span className="venta-detalle__subtitulo">{summaryLine(sale)}</span>
        </div>

        <div>
          <span className="venta-detalle__encabezado-lineas">Líneas</span>
          <div className="venta-detalle__lineas">
            {sale.lines.map((line, index) => (
              // A sale can have two lines of the same variety (a gift line and a
              // paid one, say): `SaleIn` sets no uniqueness rule on `variety_id`,
              // so the line's position — fixed and unique within one sale —
              // joins it in the key.
              <div key={`${line.variety_id}-${index}`} className="venta-detalle__linea">
                <div className="venta-detalle__linea-superior">
                  <span className="venta-detalle__variedad">{line.variety_name}</span>
                  <span className="venta-detalle__gramos">{formatGrams(line.grams)}</span>
                </div>
                <div className="venta-detalle__linea-inferior">
                  <span className="venta-detalle__precio">
                    {formatMoney(line.price_per_gram)} por gramo
                  </span>
                  <ReglaInsignia rule={line.pricing_rule} />
                  <span className="venta-detalle__total">{formatMoney(line.line_total)}</span>
                </div>
              </div>
            ))}
            <div className="venta-detalle__renglon">
              <span>Envío cobrado</span>
              <span className="venta-detalle__renglon-monto">
                {formatMoney(sale.shipping_charged)}
              </span>
            </div>
            <div className="venta-detalle__renglon venta-detalle__renglon--total">
              <span>Total</span>
              <span className="venta-detalle__renglon-monto">{formatMoney(sale.total)}</span>
            </div>
          </div>
        </div>

        {sale.note !== null && sale.note !== '' && (
          <div className="campo">
            <span className="campo__rotulo">Nota</span>
            <span className="venta-detalle__nota">{sale.note}</span>
          </div>
        )}

        {assigned && <AvisoExito texto="Cliente asignado" />}
        {assignOffline && <SinConexion />}
        {assignError !== null && (
          <span className="campo__error" role="alert">
            {assignError}
          </span>
        )}

        <div className="venta-detalle__acciones">
          {sale.customer === null && (
            <Boton variant="secondary" icon="personaMas" onClick={() => setShowAssignSheet(true)}>
              Asignar cliente
            </Boton>
          )}

          <Boton variant="link" icon="tacho" onClick={() => setConfirmingDelete(true)}>
            Borrar venta
          </Boton>
        </div>
      </div>

      {showAssignSheet && (
        <NuevaVentaCliente
          allowNone={false}
          onChosen={(customer) => void onCustomerChosen(customer)}
          onClose={() => setShowAssignSheet(false)}
        />
      )}

      {confirmingDelete && (
        <ConfirmDialog
          title={deleteTitle(sale)}
          detail="Esto no se puede deshacer."
          confirmText="Sí, borrala"
          cancelText="No, dejala"
          onConfirm={() => {
            if (!deleting) void removeSale('borrar')
          }}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
    </main>
  )
}
