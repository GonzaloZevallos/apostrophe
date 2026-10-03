/**
 * `Inicio`: the business's name, and the "Arrancá por las variedades" empty state
 * (`Estados`) when no variety has a current price today (PM round 1: "a business
 * with no priced variety" = no variety with a price in force today). No figures —
 * Inicio's panel numbers come with a later task (PRD, "Nada inventado").
 *
 * The pinned-catalog notice (plan, "Front"; accounts.md's Inicio rule): a fixed
 * line, never a figure, while `GET /pinned-catalog/status` reads `out_of_date` —
 * before the first Publicar `status` is `null` and nothing shows (PRD, "Before the
 * first Publicar").
 */

import { useQuery } from '@tanstack/react-query'
import { Link, useOutletContext } from 'react-router'
import { get } from '../api/client'
import { keys } from '../api/keys'
import type { Me } from '../api/me'

export const EMPTY_TITLE = 'Arrancá por las variedades'
export const EMPTY_DETAIL =
  'Cargá tu primera variedad con su precio. Sin precio no se puede cargar una venta.'
export const PINNED_CATALOG_OUT_OF_DATE = 'Tu catálogo en Telegram está desactualizado'

interface VarietySummary {
  current_price: unknown
}

interface PinnedCatalogStatus {
  status: { state: 'up_to_date' | 'out_of_date' } | null
}

export default function Inicio() {
  const me = useOutletContext<Me>()
  const { data } = useQuery({
    queryKey: keys.varieties(),
    queryFn: () => get<VarietySummary[]>('/varieties'),
  })
  const hasPricedVariety = (data ?? []).some((variety) => variety.current_price !== null)

  const pinnedCatalog = useQuery({
    queryKey: keys.pinnedCatalogStatus(),
    queryFn: () => get<PinnedCatalogStatus>('/pinned-catalog/status'),
  })
  const pinOutOfDate = pinnedCatalog.data?.status?.state === 'out_of_date'

  return (
    <main className="pantalla">
      <div className="cuerpo">
        <div>
          <span className="encabezado__negocio">{me.business_name}</span>
          <span className="encabezado__titulo">Inicio</span>
        </div>
        {pinOutOfDate && (
          <Link to="/catalogo" className="aviso-ambar" role="status">
            <span className="aviso-ambar__titulo">{PINNED_CATALOG_OUT_OF_DATE}</span>
          </Link>
        )}
        {data !== undefined && !hasPricedVariety && (
          <div className="estado-vacio">
            <span className="estado-vacio__titulo">{EMPTY_TITLE}</span>
            <span className="estado-vacio__detalle">{EMPTY_DETAIL}</span>
          </div>
        )}
      </div>
    </main>
  )
}
