/**
 * `Inicio`: the business's name, and the "Arrancá por las variedades" empty state
 * (`Estados`) when no variety has a current price today (PM round 1: "a business
 * with no priced variety" = no variety with a price in force today). No figures —
 * Inicio's panel numbers come with a later task (PRD, "Nada inventado").
 */

import { useQuery } from '@tanstack/react-query'
import { useOutletContext } from 'react-router'
import { get } from '../api/client'
import { keys } from '../api/keys'
import type { Me } from '../api/me'

export const EMPTY_TITLE = 'Arrancá por las variedades'
export const EMPTY_DETAIL =
  'Cargá tu primera variedad con su precio. Sin precio no se puede cargar una venta.'

interface VarietySummary {
  current_price: unknown
}

export default function Inicio() {
  const me = useOutletContext<Me>()
  const { data } = useQuery({
    queryKey: keys.varieties(),
    queryFn: () => get<VarietySummary[]>('/varieties'),
  })
  const hasPricedVariety = (data ?? []).some((variety) => variety.current_price !== null)

  return (
    <main className="pantalla">
      <div className="cuerpo">
        <div>
          <span className="encabezado__negocio">{me.business_name}</span>
          <span className="encabezado__titulo">Inicio</span>
        </div>
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
