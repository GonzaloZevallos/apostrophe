/**
 * `PriceHistory` (`VerTodas.dc.html`): a variety's whole price history, newest first, as the
 * API answers it, with "Rige desde". A card: "‹ <variety>" and no "+ Nueva venta" (the route
 * declares `chrome: 'card'`). Each row's delete asks "Antes de borrar" first, worded by
 * `priceDeleteNotice.ts` from the history alone (ADR-0003: it never mentions sales).
 */

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useLocation, useNavigate } from 'react-router'
import { ApiError, NetworkError, del, get } from '../../api/client'
import { invalidateResource, keys } from '../../api/keys'
import { isGone } from '../../api/refusals'
import ConfirmDialog from '../../components/ConfirmDialog'
import ErrorGenerico from '../../components/ErrorGenerico'
import GoneNotice from '../../components/GoneNotice'
import GoneScreen from '../../components/GoneScreen'
import Loading from '../../components/Loading'
import SinConexion from '../../components/SinConexion'
import { useFlash } from '../../flash/useFlash'
import { formatDateShort } from '../../format/dates'
import { formatGrams, formatMoney } from '../../format/money'
import { VARIETIES, VARIETY } from '../../routes'
import { deleteNotice } from '../priceDeleteNotice'
import type { Variety } from '../Variedades'

export interface PriceRow {
  id: number
  effective_from: string
  list_price: number
  bulk_price: number | null
  bulk_minimum: number | null
}

export default function PriceHistory({ varietyId }: { varietyId: number }) {
  const id = String(varietyId)
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const flash = useFlash()
  const varietyQuery = useQuery({ queryKey: keys.variety(id), queryFn: () => get<Variety>(`/varieties/${id}`) })
  const pricesQuery = useQuery({
    queryKey: keys.varietyPrices(id),
    queryFn: () => get<PriceRow[]>(`/varieties/${id}/prices`),
  })
  const [deleting, setDeleting] = useState<PriceRow | null>(null)
  const [sending, setSending] = useState(false)
  const [offline, setOffline] = useState(false)
  const [failed, setFailed] = useState(false)
  const [gone, setGone] = useState(false)

  const failure = varietyQuery.error ?? pricesQuery.error
  if (failure !== null) {
    if (failure instanceof ApiError && isGone(failure.code)) return <GoneScreen label="Variedades" to={VARIETIES} />
    return (
      <main className="pantalla">
        <div className="cuerpo">{failure instanceof NetworkError ? <SinConexion /> : <ErrorGenerico />}</div>
      </main>
    )
  }
  if (varietyQuery.data === undefined || pricesQuery.data === undefined) {
    return (
      <main className="pantalla">
        <div className="cuerpo">
          <Loading />
        </div>
      </main>
    )
  }
  const variety = varietyQuery.data
  const history = pricesQuery.data

  function goBack(event: { preventDefault: () => void }): void {
    if (location.key === 'default') return
    event.preventDefault()
    void navigate(-1)
  }

  async function onConfirmDelete(entry: PriceRow): Promise<void> {
    setSending(true)
    setOffline(false)
    setFailed(false)
    try {
      await del(`/varieties/${id}/prices/${entry.id}`)
      invalidateResource(queryClient, 'varieties')
      setDeleting(null)
      flash.showNow('Precio eliminado')
    } catch (caught) {
      setDeleting(null)
      if (caught instanceof ApiError && isGone(caught.code)) {
        invalidateResource(queryClient, 'varieties')
        setGone(true)
      } else if (caught instanceof NetworkError) {
        setOffline(true)
      } else {
        setFailed(true)
      }
    } finally {
      setSending(false)
    }
  }

  return (
    <main className="pantalla">
      <div className="cuerpo">
        <div className="encabezado__fila">
          <Link to={VARIETY(varietyId)} onClick={goBack} className="boton--enlace">
            ‹ {variety.name}
          </Link>
        </div>
        <span className="encabezado__titulo">Precios</span>
        {gone && <GoneNotice />}
        {offline && <SinConexion />}
        {failed && <ErrorGenerico />}
        <div className="historial">
          {history.map((entry) => (
            <div key={entry.id} className="historial-fila">
              <span className="historial-fila__fecha">
                Rige desde {formatDateShort(entry.effective_from)}
                {variety.current_price?.id === entry.id && (
                  <span className="historial-fila__vigente">Vigente hoy</span>
                )}
              </span>
              <span>
                <span className="historial-fila__precio">{formatMoney(entry.list_price)}</span>
                {entry.bulk_price !== null && entry.bulk_minimum !== null && (
                  <span className="historial-fila__detalle">
                    Desde {formatGrams(entry.bulk_minimum)} · {formatMoney(entry.bulk_price)}
                  </span>
                )}
              </span>
              <button
                type="button"
                className="historial-fila__borrar"
                aria-label="Borrar este precio"
                onClick={() => setDeleting(entry)}
              >
                Borrar
              </button>
            </div>
          ))}
        </div>
        <span className="campo__ayuda">Cada venta usa el precio que regía ese día, aunque lo cambies después.</span>
      </div>
      {deleting !== null && (
        <ConfirmDialog
          title={`¿Borrás el precio desde el ${formatDateShort(deleting.effective_from)}?`}
          detail={deleteNotice(history, deleting.id)}
          confirmText="Sí, borrala"
          cancelText="No, dejala"
          onConfirm={() => {
            if (!sending) void onConfirmDelete(deleting)
          }}
          onCancel={() => setDeleting(null)}
        />
      )}
    </main>
  )
}
