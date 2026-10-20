/**
 * The panel's period block (`docs/product/results.md`, "What each tab shows"): the
 * "Vendiste..." headline and, on Semana and Mes only, the result figures. One DOM serves
 * the phone and the computer: the wrappers `.panel-periodo` and `.panel-cifras` and each
 * list figure's `.panel-lista__item` add no box below 900 px (`app.css`), so the phone
 * draws exactly what it drew before; a computer lays the same nodes out as a grid.
 *
 * Every figure is a `role="group"` named by its own label (`aria-labelledby`, an id from
 * `useId`), so a screen reader and a test reach a figure by its name, with its pending note
 * inside it. Nothing here computes, compares or sign-tests an amount: Ganancia and Caja
 * go through `formatSignedMoney`, the rest through `formatMoney` / `formatGrams`.
 */

import { useId } from 'react'
import type { PanelPeriod, PanelTab } from '../../api/panel'
import { salesCount } from '../../format/counts'
import { formatGrams, formatMoney, formatSignedMoney } from '../../format/money'

const PENDING_NOTE = 'incluye costo pendiente'

/** Faltante de stock, then Promoción and Consumo propio, each on its own line and only
 * when the period has one (`null` otherwise), right before Gastos. */
const COST_LINES: Array<{ key: 'shortfall' | 'promotion' | 'own_use'; label: string }> = [
  { key: 'shortfall', label: 'Faltante de stock' },
  { key: 'promotion', label: 'Promoción' },
  { key: 'own_use', label: 'Consumo propio' },
]

const SALES_HEADING: Record<PanelTab, string> = {
  today: 'Vendiste hoy',
  week: 'Vendiste esta semana',
  month: 'Vendiste este mes',
}

/** One list figure, ready to draw. */
interface ListFigure {
  key: string
  label: string
  value: string
  pending: boolean
}

/** The seven list figures in results.md's order. A withdrawal line the period does not
 * have (`null`) is no entry: never a `$ 0` figure. */
function listFigures(period: PanelPeriod): ListFigure[] {
  const costLines = COST_LINES.flatMap(({ key, label }) => {
    const line = period[key]
    return line === null ? [] : [{ key, label, value: formatMoney(line.amount), pending: line.pending }]
  })
  return [
    { key: 'gifted', label: 'Regalaste', value: formatGrams(period.grams_gifted), pending: false },
    {
      key: 'cost_of_goods',
      label: 'Costo de lo vendido',
      value: formatMoney(period.cost_of_goods),
      pending: period.pending_cost,
    },
    ...costLines,
    { key: 'expenses', label: 'Gastos', value: formatMoney(period.expenses), pending: false },
    { key: 'purchases', label: 'Compras de flores', value: formatMoney(period.purchases), pending: false },
  ]
}

function salesSubtitle(period: PanelPeriod): string {
  const count = salesCount(period.sales_count)
  const grams = formatGrams(period.grams_sold)
  return period.average_sale === null
    ? `${count} · ${grams}`
    : `${count} · promedio ${formatMoney(period.average_sale)} · ${grams}`
}

function Headline({ tab, period }: { tab: PanelTab; period: PanelPeriod }) {
  return (
    <div className="panel-ventas">
      <span className="rotulo">{SALES_HEADING[tab]}</span>
      <span className="cifra-xl">{formatMoney(period.sales)}</span>
      <span className="pie">{salesSubtitle(period)}</span>
    </div>
  )
}

/** The headline of any tab, with the figures beside it on Semana and Mes. */
export default function PeriodPanel({ tab, period }: { tab: PanelTab; period: PanelPeriod }) {
  if (tab === 'today') {
    return (
      <div className="panel-periodo">
        <Headline tab={tab} period={period} />
      </div>
    )
  }
  return <PeriodFigures tab={tab} period={period} />
}

/** Semana's and Mes's result figures; Hoy never draws them (results.md), and the type
 * keeps it out. */
export function PeriodFigures({
  tab,
  period,
}: {
  tab: Exclude<PanelTab, 'today'>
  period: PanelPeriod
}) {
  return (
    <div className="panel-periodo panel-periodo--con-cifras">
      <Headline tab={tab} period={period} />
      <div className="panel-cifras">
        <div className="panel-lista">
          {listFigures(period).map(({ key, label, value, pending }) => (
            <ListItem key={key} label={label} value={value} pending={pending} />
          ))}
        </div>

        <div className="panel-resultados">
          <ResultCell
            label="Ganancia"
            value={formatSignedMoney(period.profit)}
            accent
            pending={period.profit_pending}
          />
          <ResultCell label="Caja" value={formatSignedMoney(period.cash)} accent={false} pending={false} />
        </div>
      </div>
    </div>
  )
}

function ListItem({ label, value, pending }: { label: string; value: string; pending: boolean }) {
  const labelId = useId()
  return (
    <div className="panel-lista__item" role="group" aria-labelledby={labelId}>
      <div className="panel-lista__fila">
        <span id={labelId}>{label}</span>
        <span className="panel-lista__valor">{value}</span>
      </div>
      {pending && <span className="pie">{PENDING_NOTE}</span>}
    </div>
  )
}

function ResultCell({
  label,
  value,
  accent,
  pending,
}: {
  label: string
  value: string
  accent: boolean
  pending: boolean
}) {
  const labelId = useId()
  return (
    <div className="panel-resultados__celda" role="group" aria-labelledby={labelId}>
      <span id={labelId} className="rotulo">
        {label}
      </span>
      <span className={accent ? 'panel-resultados__valor panel-resultados__valor--acento' : 'panel-resultados__valor'}>
        {value}
      </span>
      {pending && <span className="pie">{PENDING_NOTE}</span>}
    </div>
  )
}
