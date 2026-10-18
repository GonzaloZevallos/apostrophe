/**
 * `Analisis` (plan, subtask "Análisis screen"; `Analisis.dc.html`, `AnalisisCompu.
 * dc.html`): the month's figures by variety, week by week, month by month, by
 * weekday, since the first record, and expenses by category. `GET /analysis`
 * answers every figure, mark, sort, share and percentage already worked out
 * (CODING_STANDARDS.md section 10, "The backend decides; the front shows"): this
 * screen only formats and lays out what it is given. It adds no money or grams of
 * its own, compares no amounts to pick a label, and works out no period boundary —
 * `month.previous`/`month.next` alone drive the month nav, and `best` on a week or
 * weekday row alone drives its mark.
 *
 * The query is frozen the same way Catalogo's is (`gcTime: 0`, `staleTime:
 * Infinity`, no refetch on focus or reconnect): a seller who reopens this screen
 * must always see this open's own read, never a cached one from an earlier visit —
 * read only, no forms, no toasts (PRD, "Read only").
 */

import { Fragment, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useOutletContext } from 'react-router'
import { NetworkError } from '../api/client'
import {
  type Analysis,
  type AnalysisMonth,
  type ExpenseBreakdown as ExpenseBreakdownT,
  type RowCost,
  readAnalysis,
} from '../api/analysis'
import { keys } from '../api/keys'
import type { Me } from '../api/me'
import { formatDateShort, formatMonthLong } from '../format/dates'
import { formatGrams, formatMoney } from '../format/money'
import ErrorGenerico from '../components/ErrorGenerico'
import SinConexion from '../components/SinConexion'
import { formatRowCost } from './analisisCost'
import { WEEKDAY_SHORT, salesCount } from '../copy/format'
import { TAB_ANALYSIS, TAB_SALES } from '../copy/shell'
import * as copy from '../copy/analysis'
import { pendingSuffix } from '../format/pending'
import {
  COST_OF_GOODS_LABEL,
  EMPTY_MONTH_LINE,
  NO_BEST_WEEK_LINE,
  NO_HISTORY_LINE,
  OWN_USE_LABEL,
  PROMOTION_LABEL,
  PURCHASES_NOTE,
  SHORTFALL_LABEL,
  SINCE_FIRST_RECORD_LABEL,
  VARIETY_TOTAL_NOTE,
} from '../copy/analysis'

export {
  COST_OF_GOODS_LABEL,
  EMPTY_MONTH_LINE,
  NO_BEST_WEEK_LINE,
  NO_HISTORY_LINE,
  OWN_USE_LABEL,
  PROMOTION_LABEL,
  PURCHASES_NOTE,
  SHORTFALL_LABEL,
  SINCE_FIRST_RECORD_LABEL,
  VARIETY_TOTAL_NOTE,
}
export const { BEST_WEEK_MARK, BEST_WEEKDAY_MARK, BEST_WEEK_TABLE_MARK } = copy

/** One cost line, "Stock shortfall $ 3.000 and 1 g not yet costed": the label and
 * `formatRowCost`, in one node. */
function CostLine({ label, cost, className }: { label: string; cost: RowCost; className?: string }) {
  return (
    <span className={className}>
      {label} {formatRowCost(cost)}
    </span>
  )
}

/** Faltante de stock, Promoción and Consumo propio (CONTEXT.md), each apart and each
 * with only its own "y N g sin costo" (or only its grams when all of it is pending).
 * `null` when the period has none of that reason's records: nothing is shown. */
function WithdrawalLines({
  shortfall,
  promotion,
  ownUse,
  className,
}: {
  shortfall: RowCost | null
  promotion: RowCost | null
  ownUse: RowCost | null
  className?: string
}) {
  return (
    <>
      {shortfall !== null && <CostLine className={className} label={SHORTFALL_LABEL} cost={shortfall} />}
      {promotion !== null && <CostLine className={className} label={PROMOTION_LABEL} cost={promotion} />}
      {ownUse !== null && <CostLine className={className} label={OWN_USE_LABEL} cost={ownUse} />}
    </>
  )
}

/** What a week or month row's sales cost and lost, in the PRD order: Costo de lo
 * vendido always, then Faltante de stock, Promoción and Consumo propio when present. */
function RowCostLines({
  period,
  className,
}: {
  period: {
    cost_of_goods: RowCost
    shortfall: RowCost | null
    promotion: RowCost | null
    own_use: RowCost | null
  }
  className?: string
}) {
  return (
    <>
      <CostLine className={className} label={COST_OF_GOODS_LABEL} cost={period.cost_of_goods} />
      <WithdrawalLines
        className={className}
        shortfall={period.shortfall}
        promotion={period.promotion}
        ownUse={period.own_use}
      />
    </>
  )
}

/** The computer tables' sub-row under a week or month: the same cost lines the phone's
 * card shows, spanning the row's columns (`AnalisisCompu.dc.html`). */
function CostSubRow({
  period,
  current,
}: {
  period: Parameters<typeof RowCostLines>[0]['period']
  current: boolean
}) {
  return (
    <tr className={current ? 'analisis__fila-costos analisis__fila-actual' : 'analisis__fila-costos'}>
      <td colSpan={6}>
        <div className="analisis__costos">
          <RowCostLines period={period} />
        </div>
      </td>
    </tr>
  )
}

/** A bar's fill, purely a rendering proportion against the widest value in its own
 * list — it names no business figure of its own and decides no mark, sort, share or
 * percentage: the figure next to every bar is still the backend's own number. */
function barWidth(value: number, max: number): number {
  if (max <= 0) return 0
  return Math.max(0, Math.min(100, (value / max) * 100))
}

function Bar({ value, max }: { value: number; max: number }) {
  return (
    <span className="analisis__barra-pista">
      <span
        className="analisis__barra-llena"
        style={{ width: `${barWidth(value, max)}%` }}
      />
    </span>
  )
}

function MonthNav({
  month,
  onMonth,
}: {
  month: AnalysisMonth
  onMonth: (next: string) => void
}) {
  return (
    <div className="gastos__mes">
      <button
        type="button"
        className="gastos__mes-boton"
        aria-label={copy.MONTH_PREVIOUS}
        disabled={month.previous === null}
        onClick={() => {
          if (month.previous !== null) onMonth(month.previous)
        }}
      >
        ‹
      </button>
      <span className="gastos__mes-etiqueta">{formatMonthLong(month.month)}</span>
      <button
        type="button"
        className="gastos__mes-boton"
        aria-label={copy.MONTH_NEXT}
        disabled={month.next === null}
        onClick={() => {
          if (month.next !== null) onMonth(month.next)
        }}
      >
        ›
      </button>
    </div>
  )
}

function ExpenseBreakdownView({
  title,
  breakdown,
}: {
  title: string
  breakdown: ExpenseBreakdownT
}) {
  return (
    <div className="analisis__gastos">
      <span className="pie">{title}</span>
      {breakdown.categories.map((category) => (
        <div key={category.category_id} className="gastos__categoria-cabecera">
          <span className="gastos__categoria-nombre">{category.name}</span>
          <span className="gastos__categoria-subtotal">{formatMoney(category.total)}</span>
        </div>
      ))}
      <div className="gastos__categoria-cabecera">
        <span className="gastos__categoria-nombre">
          {copy.FLOWER_PURCHASES}
          <span className="pie"> {PURCHASES_NOTE}</span>
        </span>
        <span className="gastos__categoria-subtotal">{formatMoney(breakdown.purchases)}</span>
      </div>
    </div>
  )
}

function AnalisisContenido({
  data,
  onMonth,
}: {
  data: Analysis
  onMonth: (next: string) => void
}) {
  const m = data.month
  const maxWeekSales = Math.max(0, ...data.weeks.map((week) => week.sales))
  const maxWeekdaySales = Math.max(0, ...data.weekdays.map((day) => day.sales))

  return (
    <>
      <MonthNav month={m} onMonth={onMonth} />

      <div>
        <span className="rotulo">{copy.SOLD_THIS_MONTH}</span>
        <span className="cifra-xl">{formatMoney(m.sales)}</span>
        <span className="pie">
          {copy.soldAndGifted(formatGrams(m.grams_sold), formatGrams(m.grams_gifted))}
          {(m.average_margin.percent !== null || m.average_margin.pending_grams > 0) &&
            copy.averageMargin(m.average_margin.percent, pendingSuffix(m.average_margin.pending_grams))}
        </span>
        <WithdrawalLines
          className="pie"
          shortfall={m.shortfall}
          promotion={m.promotion}
          ownUse={m.own_use}
        />
      </div>

      <span className="pie">{VARIETY_TOTAL_NOTE}</span>

      {/* `AnalisisCompu.dc.html`: a main column (variety table, weeks, months) next
         to an aside (weekdays, since the first record, both expense breakdowns),
         wrapping side by side at computer width (`.analisis__columnas` in
         `app.css`) and stacking on the phone — CSS alone switches the layout, the
         same way `Shell`'s own side rail/bottom bar already does. */}
      <div className="analisis__columnas">
        <div className="analisis__principal">
          <span className="pie">{copy.BY_VARIETY}</span>
          {m.varieties.length === 0 ? (
            <span className="pie">{EMPTY_MONTH_LINE}</span>
          ) : (
            <>
              {/* The phone's cards (`Analisis.dc.html`): one block per variety, every
                 figure labelled inline, since there is no header row at this width. */}
              <div className="analisis__variedades">
                {m.varieties.map((variety) => (
                  <div key={variety.variety_id} className="analisis__variedad">
                    <div className="analisis__variedad-cabecera">
                      <span className="analisis__variedad-nombre">{variety.name}</span>
                      <span className="analisis__variedad-ventas">
                        {formatMoney(variety.sales_without_shipping)}
                      </span>
                    </div>
                    <div className="analisis__variedad-detalle">
                      {variety.share_percent !== null && (
                        <span>{copy.shareOfMonth(variety.share_percent)}</span>
                      )}
                      <span>{copy.gramsSold(formatGrams(variety.grams_sold))}</span>
                      <span>{copy.gramsGifted(formatGrams(variety.grams_gifted))}</span>
                      <span>
                        {copy.costOf(
                          formatMoney(variety.cost.costed),
                          pendingSuffix(variety.cost.pending_grams),
                        )}
                      </span>
                      <span className="analisis__variedad-margen">
                        {copy.marginOf(
                          formatMoney(variety.margin.amount),
                          variety.margin.percent,
                          pendingSuffix(variety.margin.pending_grams),
                        )}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* The computer's table (`AnalisisCompu.dc.html`): the same rows, with
                 column headers instead of inline labels, sold and gifted grams in
                 their own columns, and the margin cell stacking the peso amount
                 over its percentage. CSS alone picks one of these two, the same
                 way `Shell`'s side rail/bottom bar already do. */}
              <div className="analisis__tabla-contenedor analisis__tabla-contenedor--variedades">
                <table className="analisis__tabla">
                  <thead>
                    <tr>
                      <th>{copy.COL_VARIETY}</th>
                      <th className="analisis__num">{TAB_SALES}</th>
                      <th className="analisis__num">{copy.COL_SHARE}</th>
                      <th className="analisis__num">{copy.COL_GRAMS}</th>
                      <th className="analisis__num">{copy.COL_GIFT_GRAMS}</th>
                      <th className="analisis__num">{copy.COL_COST}</th>
                      <th className="analisis__num">{copy.COL_MARGIN}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {m.varieties.map((variety) => (
                      <tr key={variety.variety_id}>
                        <td>{variety.name}</td>
                        <td className="analisis__num">
                          {formatMoney(variety.sales_without_shipping)}
                        </td>
                        <td className="analisis__num">
                          {variety.share_percent !== null ? `${variety.share_percent}%` : ''}
                        </td>
                        <td className="analisis__num">{formatGrams(variety.grams_sold)}</td>
                        <td className="analisis__num">{formatGrams(variety.grams_gifted)}</td>
                        <td className="analisis__num">
                          {formatMoney(variety.cost.costed)}
                          {pendingSuffix(variety.cost.pending_grams)}
                        </td>
                        <td className="analisis__num analisis__celda-margen">
                          <span>
                            {formatMoney(variety.margin.amount)}
                            {pendingSuffix(variety.margin.pending_grams)}
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
            </>
          )}

          <span className="pie">{copy.WEEK_BY_WEEK}</span>
          <div className="analisis__semanas">
            {data.weeks.map((week) => (
              <div key={week.first_day} className="analisis__semana">
                <span>{formatDateShort(week.first_day)}</span>
                <Bar value={week.sales} max={maxWeekSales} />
                <span>{formatMoney(week.sales)}</span>
                <span>{formatGrams(week.grams)}</span>
                <div className="analisis__costos">
                  <RowCostLines period={week} />
                </div>
                <span>{copy.expensesOf(formatMoney(week.expenses))}</span>
                <span>
                  {copy.profitOf(formatMoney(week.profit.amount), pendingSuffix(week.profit.pending_grams))}
                </span>
                <span>{copy.cashOf(formatMoney(week.cash))}</span>
                {week.best && <span className="analisis__marca-mejor">{BEST_WEEK_MARK}</span>}
              </div>
            ))}
          </div>

          <div className="analisis__tabla-contenedor analisis__tabla-contenedor--semanas">
            <table className="analisis__tabla">
              <thead>
                <tr>
                  <th>{copy.WEEK}</th>
                  <th className="analisis__num">{TAB_SALES}</th>
                  <th className="analisis__num">{copy.COL_GRAMS}</th>
                  <th className="analisis__num">{copy.EXPENSES}</th>
                  <th className="analisis__num">{copy.PROFIT}</th>
                  <th className="analisis__num">{copy.CASH}</th>
                </tr>
              </thead>
              <tbody>
                {data.weeks.map((week, index) => (
                  <Fragment key={week.first_day}>
                  <tr
                    className={
                      index === data.weeks.length - 1 ? 'analisis__fila-actual' : undefined
                    }
                  >
                    <td>{formatDateShort(week.first_day)}</td>
                    <td className="analisis__num">{formatMoney(week.sales)}</td>
                    <td className="analisis__num">{formatGrams(week.grams)}</td>
                    <td className="analisis__num">{formatMoney(week.expenses)}</td>
                    <td className="analisis__num">
                      {formatMoney(week.profit.amount)}
                      {pendingSuffix(week.profit.pending_grams)}
                      {week.best && (
                        <span className="analisis__etiqueta-mejor">{BEST_WEEK_TABLE_MARK}</span>
                      )}
                    </td>
                    <td className="analisis__num">{formatMoney(week.cash)}</td>
                  </tr>
                  <CostSubRow period={week} current={index === data.weeks.length - 1} />
                  </Fragment>
                ))}
              </tbody>
            </table>
            {data.weeks.length > 0 && data.weeks.every((week) => !week.best) && (
              <span className="pie">{NO_BEST_WEEK_LINE}</span>
            )}
          </div>

          <span className="pie">{copy.MONTH_BY_MONTH}</span>
          <div className="analisis__meses">
            {data.months.map((row) => (
              <div key={row.month} className="analisis__mes-fila">
                <span>{formatMonthLong(row.month)}</span>
                <span>{formatMoney(row.sales)}</span>
                <span>{formatGrams(row.grams)}</span>
                <div className="analisis__costos">
                  <RowCostLines period={row} />
                </div>
                <span>{copy.expensesOf(formatMoney(row.expenses))}</span>
                <span>
                  {copy.profitOf(formatMoney(row.profit.amount), pendingSuffix(row.profit.pending_grams))}
                </span>
                <span>{copy.cashOf(formatMoney(row.cash))}</span>
              </div>
            ))}
          </div>

          <div className="analisis__tabla-contenedor analisis__tabla-contenedor--meses">
            <table className="analisis__tabla">
              <thead>
                <tr>
                  <th>{copy.MONTH}</th>
                  <th className="analisis__num">{TAB_SALES}</th>
                  <th className="analisis__num">{copy.COL_GRAMS}</th>
                  <th className="analisis__num">{copy.EXPENSES}</th>
                  <th className="analisis__num">{copy.PROFIT}</th>
                  <th className="analisis__num">{copy.CASH}</th>
                </tr>
              </thead>
              <tbody>
                {data.months.map((row) => (
                  <Fragment key={row.month}>
                  <tr>
                    <td>{formatMonthLong(row.month)}</td>
                    <td className="analisis__num">{formatMoney(row.sales)}</td>
                    <td className="analisis__num">{formatGrams(row.grams)}</td>
                    <td className="analisis__num">{formatMoney(row.expenses)}</td>
                    <td className="analisis__num">
                      {formatMoney(row.profit.amount)}
                      {pendingSuffix(row.profit.pending_grams)}
                    </td>
                    <td className="analisis__num">{formatMoney(row.cash)}</td>
                  </tr>
                  <CostSubRow period={row} current={false} />
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="analisis__aside">
          <span className="pie">{copy.BY_WEEKDAY}</span>
          <div className="analisis__dias">
            {data.weekdays.map((day) => (
              <div key={day.weekday} className="analisis__dia">
                <span>{WEEKDAY_SHORT[day.weekday - 1]}</span>
                <Bar value={day.sales} max={maxWeekdaySales} />
                <span>{formatMoney(day.sales)}</span>
                <span>{salesCount(day.count)}</span>
                {day.best && <span className="analisis__marca-mejor">{BEST_WEEKDAY_MARK}</span>}
              </div>
            ))}
          </div>

          {data.since_first_record !== null && (
            <div className="analisis__historico">
              <span className="pie">{SINCE_FIRST_RECORD_LABEL}</span>
              <span>{formatMoney(data.since_first_record.sales)}</span>
              <span>{copy.expensesOf(formatMoney(data.since_first_record.expenses))}</span>
              <span>
                {copy.profitOf(
                  formatMoney(data.since_first_record.profit.amount),
                  pendingSuffix(data.since_first_record.profit.pending_grams),
                )}
              </span>
              <span>{copy.cashOf(formatMoney(data.since_first_record.cash))}</span>
              <WithdrawalLines
                shortfall={data.since_first_record.shortfall}
                promotion={data.since_first_record.promotion}
                ownUse={data.since_first_record.own_use}
              />
            </div>
          )}

          <ExpenseBreakdownView title={copy.MONTH_EXPENSES_TITLE} breakdown={data.month_expenses} />
          <ExpenseBreakdownView
            title={copy.SINCE_FIRST_RECORD_EXPENSES_TITLE}
            breakdown={data.since_first_record_expenses}
          />
        </aside>
      </div>
    </>
  )
}

export default function Analisis() {
  const me = useOutletContext<Me>()
  const [month, setMonth] = useState(() => me.today.slice(0, 7))

  const query = useQuery({
    queryKey: keys.analysis(month),
    queryFn: () => readAnalysis(month),
    gcTime: 0,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })

  return (
    <main className="pantalla">
      <div className="cuerpo">
        <div className="encabezado__fila">
          <span className="encabezado__titulo">{TAB_ANALYSIS}</span>
        </div>

        {query.isError && query.error instanceof NetworkError && <SinConexion />}
        {query.isError && !(query.error instanceof NetworkError) && <ErrorGenerico />}

        {query.data !== undefined && query.data.first_record === null && (
          <span className="pie">{NO_HISTORY_LINE}</span>
        )}

        {query.data !== undefined && query.data.first_record !== null && (
          <AnalisisContenido data={query.data} onMonth={setMonth} />
        )}
      </div>
    </main>
  )
}
