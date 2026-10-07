/**
 * "Precios" on a variety's page: its last 3 price rows, each with its delete ("Antes de
 * borrar"), and "Ver todas" to the whole history.
 */

import InAppLink from '../../components/InAppLink'
import { VARIETY_PRICES, pathTo } from '../../routes'
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
        <InAppLink to={pathTo(VARIETY_PRICES, { id: varietyId })}>Ver todas</InAppLink>
      </div>
      <PriceRows varietyId={varietyId} history={history} currentPriceId={currentPriceId} limit={3} readOnly={readOnly} />
    </section>
  )
}
