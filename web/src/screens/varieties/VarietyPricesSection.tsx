/**
 * "Precios" on a variety's page: its last 3 price rows, each with its delete ("Antes de
 * borrar"), and "Ver todas" to the whole history.
 */

import { Link } from 'react-router'
import { VARIETY_PRICES } from '../../routes'
import PriceRows, { type PriceRow } from './PriceRows'

export default function VarietyPricesSection({
  varietyId,
  history,
  currentPriceId,
  readOnly = false,
}: {
  varietyId: number
  history: PriceRow[]
  currentPriceId: number | null
  readOnly?: boolean
}) {
  return (
    <section className="seccion-variedad">
      <div className="seccion-variedad__cabecera">
        <h2 className="seccion-variedad__titulo">Precios</h2>
        <Link to={VARIETY_PRICES(varietyId)}>Ver todas</Link>
      </div>
      <PriceRows varietyId={varietyId} history={history} currentPriceId={currentPriceId} limit={3} readOnly={readOnly} />
    </section>
  )
}
