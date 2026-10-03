/**
 * `VentaDetalle` (`sales.md`, "On screen: Detalle de venta"): the total, each line
 * with its price per gram and rule badge, shipping, the note, how it was paid, and
 * the customer or "Sin cliente" — all from the API's own answer (docs/adr/0009;
 * plan, invariants: nothing here is the preview). "Borrás la venta" is confirmed
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
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { ApiError, NetworkError } from '../../api/client'
import type { Customer } from '../../api/customers'
import { invalidateResource, keys } from '../../api/keys'
import { assignCustomer, deleteSale, getSale, type Sale } from '../../api/sales'
import { GONE_NOTICE, isGone, resolveOverride, type RefusalCode } from '../../api/refusals'
import AvisoExito from '../../components/AvisoExito'
import ConfirmDialog from '../../components/ConfirmDialog'
import { clearSaleJustSaved, readFeedback, SALE_SAVED } from '../../components/feedback'
import ErrorGenerico from '../../components/ErrorGenerico'
import GoneScreen from '../../components/GoneScreen'
import SinConexion from '../../components/SinConexion'
import { formatDateShort } from '../../format/dates'
import { formatGrams, formatMoney } from '../../format/money'
import type { PricingRule } from '../../sales/pricing'
import { GENERIC_REFUSAL } from '../clientes/ClienteForm'
import NuevaVentaCliente from './NuevaVentaCliente'

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

const RULE_LABEL: Record<PricingRule, string> = {
  list: 'Lista',
  bulk: 'Por cantidad',
  vip: 'VIP',
  gift: 'Regalo',
  special: 'Especial',
}

const PAYMENT_LABEL: Record<Exclude<Sale['payment'], 'none'>, string> = {
  cash: 'Efectivo',
  transfer: 'Transferencia',
  owing: 'Debiendo',
}

function deleteTitle(sale: Sale): string {
  return `¿Borrás la venta de ${formatMoney(sale.total)} del ${formatDateShort(sale.date)}?`
}

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
      // The PUT already answers the sale as it now stands (docs/adr/0009): this
      // writes that answer straight into the cache instead of a second `GET`
      // (plan, invariants: what is shown comes from the API's answer).
      queryClient.setQueryData(keys.sale(saleId), updated)
      invalidateResource(queryClient, 'sales')
      setAssigned(true)
    } catch (caught) {
      if (caught instanceof ApiError && isGone(caught.code)) {
        // The sale, or the customer just chosen, is gone (a partner deleted
        // either meanwhile): the same gone path `removeSale` takes below.
        invalidateResource(queryClient, 'sales')
        navigate('/ventas', { replace: true, state: { notice: GONE_NOTICE } })
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

  async function removeSale(): Promise<void> {
    setDeleting(true)
    setDeleteOffline(false)
    setDeleteFailed(false)
    try {
      await deleteSale(saleId)
      invalidateResource(queryClient, 'sales')
      navigate('/ventas', { replace: true, state: { toast: 'Venta eliminada' } })
    } catch (caught) {
      if (caught instanceof ApiError && isGone(caught.code)) {
        invalidateResource(queryClient, 'sales')
        navigate('/ventas', { replace: true, state: { notice: GONE_NOTICE } })
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
      return <GoneScreen label="Ventas" to="/ventas" />
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
        <div>
          <Link to="/ventas">Volver</Link>
          <span className="encabezado__titulo">Venta</span>
        </div>

        {undoAvailable && (
          <div className="venta-guardada" role="status">
            <span className="venta-guardada__texto">{SALE_SAVED}</span>
            <button
              type="button"
              className="venta-guardada__deshacer"
              disabled={deleting}
              onClick={() => void removeSale()}
            >
              Deshacer
            </button>
          </div>
        )}
        {deleteOffline && <SinConexion />}
        {deleteFailed && <ErrorGenerico />}

        <span className="cifra-xl">{formatMoney(sale.total)}</span>

        <div className="venta-detalle__lineas">
          {sale.lines.map((line, index) => (
            // A sale can have two lines of the same variety (a gift line and a paid
            // one, say): `SaleIn` sets no uniqueness rule on `variety_id`, so the
            // line's position — fixed and unique within one sale — joins it in the key.
            <div key={`${line.variety_id}-${index}`} className="venta-detalle__linea">
              <span className="venta-detalle__variedad">
                {line.variety_name}
                <span className="regla-insignia">{RULE_LABEL[line.pricing_rule]}</span>
              </span>
              <span className="venta-detalle__gramos">{formatGrams(line.grams)}</span>
              <span className="venta-detalle__precio">{formatMoney(line.price_per_gram)}/g</span>
              <span className="venta-detalle__total">{formatMoney(line.line_total)}</span>
            </div>
          ))}
        </div>

        <div className="campo">
          <span className="campo__rotulo">Envío cobrado</span>
          <span>{formatMoney(sale.shipping_charged)}</span>
        </div>

        {sale.note !== null && sale.note !== '' && (
          <div className="campo">
            <span className="campo__rotulo">Nota</span>
            <span>{sale.note}</span>
          </div>
        )}

        {sale.payment !== 'none' && (
          <div className="campo">
            <span className="campo__rotulo">Cómo se pagó</span>
            <span>{PAYMENT_LABEL[sale.payment]}</span>
          </div>
        )}

        <div className="campo">
          <span className="campo__rotulo">Cliente</span>
          <span>
            {sale.customer === null ? (
              <span className="fila-venta__sin-cliente">Sin cliente</span>
            ) : (
              <>
                {sale.customer.name}
                {sale.customer.vip && <span className="vip-insignia">VIP</span>}
              </>
            )}
          </span>
        </div>

        {assigned && <AvisoExito texto="Cliente asignado" />}
        {assignOffline && <SinConexion />}
        {assignError !== null && (
          <span className="campo__error" role="alert">
            {assignError}
          </span>
        )}

        {sale.customer === null && (
          <button
            type="button"
            className="boton--enlace"
            onClick={() => setShowAssignSheet(true)}
          >
            Asignar cliente
          </button>
        )}

        <button
          type="button"
          className="boton--enlace"
          onClick={() => setConfirmingDelete(true)}
        >
          Borrar venta
        </button>
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
            if (!deleting) void removeSale()
          }}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
    </main>
  )
}
