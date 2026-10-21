/**
 * "Precios" on a variety's page: its last 3 price rows, each with its delete ("Antes de
 * borrar"), and "Ver todas" to the whole history.
 */

import BotonLink from '../../components/BotonLink'
import { VARIETY_PRICES, pathTo } from '../../routes'
import PriceRows, { type PriceRow } from './PriceRows'
import { VARIETIES_TEXT } from '../../copy/varieties'
import { COMMON_TEXT } from '../../copy/common'

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
        <h2 className="seccion-variedad__titulo">{COMMON_TEXT.prices}</h2>
        <BotonLink variant="link" to={pathTo(VARIETY_PRICES, { id: varietyId })}>{VARIETIES_TEXT.verTodas}</BotonLink>
      </div>
      <PriceRows varietyId={varietyId} history={history} currentPriceId={currentPriceId} limit={3} readOnly={readOnly} />
    </section>
  )
}
