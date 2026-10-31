/**
 * The phone's three card lists (variety, week, month), rendered only at phone width, chosen
 * once by `useViewport()` in `AnalisisContenido`; the computer renders the tables
 * (`AnalisisTablas`). The section headings and the empty-month line are shared nodes in
 * `Analisis.tsx`. No `AmountRow`, `RowCostLines` or `WithdrawalLines` here: the rows come
 * from `analisisCards`.
 */

import type { Analysis } from '../api/analysis'
import Bar from './analisis/Bar'
import NoBestWeekLine from './analisis/NoBestWeekLine'
import { monthCard, varietyCard, weekCard } from './analisisCards'
import AnalisisTarjeta from './AnalisisTarjeta'

export function TarjetasVariedades({ products }: { products: Analysis['month']['products'] }) {
  return (
    <div className="analisis__variedades">
      {products.map((variety) => (
        <AnalisisTarjeta key={variety.product_id} card={varietyCard(variety)} />
      ))}
    </div>
  )
}

export function TarjetasSemanas({ weeks }: { weeks: Analysis['weeks'] }) {
  const maxSales = Math.max(0, ...weeks.map((week) => week.sales))
  return (
    <>
      <div className="analisis__semanas">
        {weeks.map((week, index) => (
          <AnalisisTarjeta
            key={week.first_day}
            card={weekCard(week, index === weeks.length - 1)}
            bar={<Bar value={week.sales} max={maxSales} decorative />}
          />
        ))}
      </div>
      <NoBestWeekLine weeks={weeks} />
    </>
  )
}

export function TarjetasMeses({ months }: { months: Analysis['months'] }) {
  return (
    <div className="analisis__meses">
      {months.map((row) => (
        <AnalisisTarjeta key={row.month} card={monthCard(row)} />
      ))}
    </div>
  )
}
