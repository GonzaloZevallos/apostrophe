/**
 * `PriceHistory` (`VerTodas.dc.html`): a variety's whole price history, newest first, as the
 * API answers it, with "Rige desde". A card: "‹ <variety>" and no "+ Nueva venta" (the route
 * declares `chrome: 'card'`). Each row's delete asks "Antes de borrar" first, worded by
 * `priceDeleteNotice.ts` from the history alone (ADR-0003: it never mentions sales).
 */

import { useQuery } from '@tanstack/react-query'
import { ApiError, NetworkError, get } from '../../api/client'
import { keys } from '../../api/keys'
import { isGone } from '../../api/refusals'
import ErrorGenerico from '../../components/ErrorGenerico'
import GoneScreen from '../../components/GoneScreen'
import Loading from '../../components/Loading'
import SinConexion from '../../components/SinConexion'
import { VARIETIES } from '../../routes'
import { useCardRecord } from '../../shell/useCardRecord'
import type { Variety } from '../Variedades'
import PriceRows, { type PriceRow } from './PriceRows'
import { PRICE_HISTORY_HELP } from './varietiesMessages'

export default function PriceHistory({ varietyId }: { varietyId: number }) {
  const id = String(varietyId)
  const varietyQuery = useQuery({ queryKey: keys.variety(id), queryFn: () => get<Variety>(`/varieties/${id}`) })
  const pricesQuery = useQuery({
    queryKey: keys.varietyPrices(id),
    queryFn: () => get<PriceRow[]>(`/varieties/${id}/prices`),
  })
  const loaded = varietyQuery.data
  useCardRecord(
    loaded === undefined ? undefined : { id: varietyId, archived: loaded.archived === true, name: loaded.name },
  )
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

  return (
    <main className="pantalla">
      <div className="cuerpo">
        <span className="encabezado__titulo">Precios</span>
        <PriceRows
          varietyId={varietyId}
          history={history}
          currentPriceId={variety.current_price?.id ?? null}
          readOnly={variety.archived}
        />
        <span className="campo__ayuda" data-copy="help">{PRICE_HISTORY_HELP}</span>
      </div>
    </main>
  )
}
