/**
 * The computer's three tables (variety, week, month) and the cost sub-row under each week
 * and month (`AnalisisCompu.dc.html`). Rendered only at computer width, chosen once by
 * `useViewport()` in `AnalisisContenido`; the phone renders cards instead.
 */

import { Fragment } from 'react'
import type { Analysis } from '../api/analysis'
import { formatDateShort, formatMonthLong } from '../format/dates'
import { formatGrams, formatMoney } from '../format/money'
import { ANALYSIS_TEXT } from '../copy/analysis'
import { COMMON_TEXT } from '../copy/common'
import { BEST_WEEK_TABLE_MARK } from './analisis/marks'
import { type CostPeriod, RowCostLines } from './analisis/CostLines'
import { pendingSuffix } from './analisis/pendingSuffix'
import NoBestWeekLine from './analisis/NoBestWeekLine'

/** The computer tables' sub-row under a week or month: the same cost lines the phone's
 * card shows, spanning the row's columns (`AnalisisCompu.dc.html`). */
function CostSubRow({
  period,
  current,
  labelId,
}: {
  period: CostPeriod
  current: boolean
  /** The id of the date cell of the row above: it names this group. */
  labelId: string
}) {
  return (
    <tr className={current ? 'analisis__fila-costos analisis__fila-actual' : 'analisis__fila-costos'}>
      <td colSpan={6}>
        <div role="group" aria-labelledby={labelId} className="analisis__costos">
          <RowCostLines period={period} />
        </div>
      </td>
    </tr>
  )
}

export function TablaVariedades({ varieties }: { varieties: Analysis['month']['varieties'] }) {
  return (
    <div className="analisis__tabla-contenedor analisis__tabla-contenedor--variedades">
      <table className="analisis__tabla">
        <thead>
          <tr>
            <th>{COMMON_TEXT.variety}</th>
            <th className="analisis__num">{COMMON_TEXT.sales}</th>
            <th className="analisis__num">{ANALYSIS_TEXT.parte}</th>
            <th className="analisis__num">{COMMON_TEXT.grams}</th>
            <th className="analisis__num">{ANALYSIS_TEXT.gramosRegalo}</th>
            <th className="analisis__num">{ANALYSIS_TEXT.costLabel}</th>
            <th className="analisis__num">{ANALYSIS_TEXT.margen2}</th>
          </tr>
        </thead>
        <tbody>
          {varieties.map((variety) => (
            <tr key={variety.variety_id}>
              <td>{variety.name}</td>
              <td className="analisis__num">
                {formatMoney(variety.sales_without_shipping)}
              </td>
              <td className="analisis__num">
                {variety.share_percent !== null ? `${variety.share_percent}%` : ''}
              </td>
              <td className="analisis__num">{formatGrams(variety.quantity_sold)}</td>
              <td className="analisis__num">{formatGrams(variety.quantity_gifted)}</td>
              <td className="analisis__num">
                {formatMoney(variety.cost.costed)}
                {pendingSuffix(variety.cost.pending_quantity)}
              </td>
              <td className="analisis__num analisis__celda-margen">
                <span>
                  {formatMoney(variety.margin.amount)}
                  {pendingSuffix(variety.margin.pending_quantity)}
                </span>
                {variety.margin.percent !== null && (
                  <span>{variety.margin.percent}%</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function TablaSemanas({ weeks, ids }: { weeks: Analysis['weeks']; ids: string }) {
  return (
    <div className="analisis__tabla-contenedor analisis__tabla-contenedor--semanas">
      <table className="analisis__tabla">
        <thead>
          <tr>
            <th>{COMMON_TEXT.week}</th>
            <th className="analisis__num">{COMMON_TEXT.sales}</th>
            <th className="analisis__num">{COMMON_TEXT.grams}</th>
            <th className="analisis__num">{COMMON_TEXT.expenses}</th>
            <th className="analisis__num">{COMMON_TEXT.profit}</th>
            <th className="analisis__num">{COMMON_TEXT.cash}</th>
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, index) => (
            <Fragment key={week.first_day}>
            <tr
              className={
                index === weeks.length - 1 ? 'analisis__fila-actual' : undefined
              }
            >
              <td id={`${ids}-wt-${week.first_day}`}>{formatDateShort(week.first_day)}</td>
              <td className="analisis__num">{formatMoney(week.sales)}</td>
              <td className="analisis__num">{formatGrams(week.quantity)}</td>
              <td className="analisis__num">{formatMoney(week.expenses)}</td>
              <td className="analisis__num">
                {formatMoney(week.profit.amount)}
                {pendingSuffix(week.profit.pending_quantity)}
                {week.best && (
                  <span className="analisis__etiqueta-mejor">{BEST_WEEK_TABLE_MARK}</span>
                )}
              </td>
              <td className="analisis__num">{formatMoney(week.cash)}</td>
            </tr>
            <CostSubRow
              period={week}
              current={index === weeks.length - 1}
              labelId={`${ids}-wt-${week.first_day}`}
            />
            </Fragment>
          ))}
        </tbody>
      </table>
      <NoBestWeekLine weeks={weeks} />
    </div>
  )
}

export function TablaMeses({ months, ids }: { months: Analysis['months']; ids: string }) {
  return (
    <div className="analisis__tabla-contenedor analisis__tabla-contenedor--meses">
      <table className="analisis__tabla">
        <thead>
          <tr>
            <th>{COMMON_TEXT.month}</th>
            <th className="analisis__num">{COMMON_TEXT.sales}</th>
            <th className="analisis__num">{COMMON_TEXT.grams}</th>
            <th className="analisis__num">{COMMON_TEXT.expenses}</th>
            <th className="analisis__num">{COMMON_TEXT.profit}</th>
            <th className="analisis__num">{COMMON_TEXT.cash}</th>
          </tr>
        </thead>
        <tbody>
          {months.map((row) => (
            <Fragment key={row.month}>
            <tr>
              <td id={`${ids}-mt-${row.month}`}>{formatMonthLong(row.month)}</td>
              <td className="analisis__num">{formatMoney(row.sales)}</td>
              <td className="analisis__num">{formatGrams(row.quantity)}</td>
              <td className="analisis__num">{formatMoney(row.expenses)}</td>
              <td className="analisis__num">
                {formatMoney(row.profit.amount)}
                {pendingSuffix(row.profit.pending_quantity)}
              </td>
              <td className="analisis__num">{formatMoney(row.cash)}</td>
            </tr>
            <CostSubRow period={row} current={false} labelId={`${ids}-mt-${row.month}`} />
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}
