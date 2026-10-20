/**
 * A variety's price rows, newest first, as the API answers them, each with "Rige desde",
 * "Vigente hoy" on the one in force and a delete that asks "Antes de borrar" first, worded
 * by `priceDeleteNotice.ts` from the whole history alone (ADR-0003: it never mentions
 * sales). Shared by `PriceHistory` (every row) and a variety's page (its last 3, `limit`),
 * so the delete is one flow in one place.
 */

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, NetworkError, del } from '../../api/client'
import { invalidateResource } from '../../api/keys'
import { pricingSettingsQueryOptions } from '../../api/pricingSettings'
import { isGone } from '../../api/refusals'
import Boton from '../../components/Boton'
import ConfirmDialog from '../../components/ConfirmDialog'
import ErrorGenerico from '../../components/ErrorGenerico'
import GoneNotice from '../../components/GoneNotice'
import SinConexion from '../../components/SinConexion'
import { useFlash } from '../../flash/useFlash'
import { formatDateShort } from '../../format/dates'
import { formatGrams, formatMoney } from '../../format/money'
import { NO_KEEP_IT, YES_DELETE_IT } from '../../copy/stock'
import {
  CURRENT_PRICE,
  DELETE_PRICE,
  PRICE_DELETED,
  bulkFrom,
  deletePriceTitle,
  effectiveFrom,
  vipLine,
} from '../../copy/varieties'
import { deleteNotice } from '../priceDeleteNotice'

export interface PriceRow {
  id: number
  effective_from: string
  list_price: number
  bulk_price: number | null
  bulk_minimum: number | null
  vip_price: number | null
}

interface Props {
  varietyId: number
  history: PriceRow[]
  currentPriceId: number | null
  limit?: number
  /** An archived variety's price rows: no delete beside any of them. */
  readOnly?: boolean
}

export default function PriceRows({ varietyId, history, currentPriceId, limit, readOnly = false }: Props) {
  const queryClient = useQueryClient()
  // Until the switches are known (or if they cannot be read) nothing about a rule shows.
  const settings = useQuery(pricingSettingsQueryOptions()).data
  const showBulk = settings?.is_bulk_pricing === true
  const showVip = settings?.is_vip_customers === true
  const flash = useFlash()
  const [deleting, setDeleting] = useState<PriceRow | null>(null)
  const [sending, setSending] = useState(false)
  const [offline, setOffline] = useState(false)
  const [failed, setFailed] = useState(false)
  const [gone, setGone] = useState(false)

  async function onConfirmDelete(entry: PriceRow): Promise<void> {
    setSending(true)
    setOffline(false)
    setFailed(false)
    try {
      await del(`/varieties/${varietyId}/prices/${entry.id}`)
      invalidateResource(queryClient, 'varieties' as const)
      setDeleting(null)
      flash.showNow(PRICE_DELETED)
    } catch (caught) {
      setDeleting(null)
      if (caught instanceof ApiError && isGone(caught.code)) {
        invalidateResource(queryClient, 'varieties' as const)
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

  const rows = limit === undefined ? history : history.slice(0, limit)
  return (
    <>
      {gone && <GoneNotice />}
      {offline && <SinConexion />}
      {failed && <ErrorGenerico />}
      <div className="historial">
        {rows.map((entry) => (
          <div key={entry.id} className="historial-fila">
            <span className="historial-fila__fecha">
              {effectiveFrom(formatDateShort(entry.effective_from))}
              {currentPriceId === entry.id && <span className="historial-fila__vigente">{CURRENT_PRICE}</span>}
            </span>
            <span>
              <span className="historial-fila__precio">{formatMoney(entry.list_price)}</span>
              {showBulk && entry.bulk_price !== null && entry.bulk_minimum !== null && (
                <span className="historial-fila__detalle">
                  {bulkFrom(formatGrams(entry.bulk_minimum), formatMoney(entry.bulk_price))}
                </span>
              )}
              {showVip && entry.vip_price !== null && (
                <span className="historial-fila__detalle">{vipLine(formatMoney(entry.vip_price))}</span>
              )}
            </span>
            {!readOnly && (
              <Boton variant="icon" action="delete" ariaLabel={DELETE_PRICE} onClick={() => setDeleting(entry)} />
            )}
          </div>
        ))}
      </div>
      {deleting !== null && (
        <ConfirmDialog
          title={deletePriceTitle(formatDateShort(deleting.effective_from))}
          detail={deleteNotice(history, deleting.id)}
          confirmText={YES_DELETE_IT}
          cancelText={NO_KEEP_IT}
          onConfirm={() => {
            if (!sending) void onConfirmDelete(deleting)
          }}
          onCancel={() => setDeleting(null)}
        />
      )}
    </>
  )
}
