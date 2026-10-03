/**
 * `VentaDetalle` (`sales.md`, "On screen: Detalle de venta"): the total, each line
 * with its price per gram and rule badge, shipping, the note, how it was paid, and
 * the customer or "Sin cliente" — all from the API's own answer (docs/adr/0009;
 * plan, invariants: nothing here is the preview). "Borrás la venta" is confirmed
 * with `Antes de borrar`, naming the date and the amount; "Venta guardada" with
 * Deshacer (`Estados`) is this screen's own banner, read once through
 * `readFeedback`/`clearSaleJustSaved` and cleared from history state so a refresh
 * or Back never resurrects it. `assign-customer` later adds "Asignar cliente" to
 * this same module, only for a sale that has none.
 */

import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { ApiError, NetworkError } from '../../api/client'
import { invalidateResource, keys } from '../../api/keys'
import { deleteSale, getSale, type Sale } from '../../api/sales'
import { GONE_NOTICE, isGone } from '../../api/refusals'
import ConfirmDialog from '../../components/ConfirmDialog'
import { clearSaleJustSaved, readFeedback, SALE_SAVED } from '../../components/feedback'
import ErrorGenerico from '../../components/ErrorGenerico'
import GoneScreen from '../../components/GoneScreen'
import SinConexion from '../../components/SinConexion'
import { formatDateShort } from '../../format/dates'
import { formatGrams, formatMoney } from '../../format/money'
import type { PricingRule } from '../../sales/pricing'

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
          {sale.lines.map((line) => (
            <div key={line.variety_id} className="venta-detalle__linea">
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

        <button
          type="button"
          className="boton--enlace"
          onClick={() => setConfirmingDelete(true)}
        >
          Borrar venta
        </button>
      </div>

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
