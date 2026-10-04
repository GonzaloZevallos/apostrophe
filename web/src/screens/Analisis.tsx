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

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useOutletContext } from 'react-router'
import { NetworkError } from '../api/client'
import {
  type Analysis,
  type AnalysisMonth,
  type ExpenseBreakdown as ExpenseBreakdownT,
  readAnalysis,
} from '../api/analysis'
import { keys } from '../api/keys'
import type { Me } from '../api/me'
import { formatDateShort, formatMonthLong } from '../format/dates'
import { formatGrams, formatMoney } from '../format/money'
import ErrorGenerico from '../components/ErrorGenerico'
import SinConexion from '../components/SinConexion'

export const NO_HISTORY_LINE = 'Todavía no hay nada para analizar.'
export const EMPTY_MONTH_LINE = 'No vendiste ni regalaste nada este mes.'
export const VARIETY_TOTAL_NOTE =
  'La tabla de variedades suma las ventas del mes sin el envío.'
export const SINCE_FIRST_RECORD_LABEL =
  'Movido desde tu primer registro, no es la plata que tenés en caja'
export const PURCHASES_NOTE = 'Van aparte, se cargan en Stock'
export const BEST_WEEK_MARK = 'Mejor semana'
export const BEST_WEEKDAY_MARK = 'Mejor día'

const WEEKDAY_LABEL: Record<number, string> = {
  1: 'Lun',
  2: 'Mar',
  3: 'Mié',
  4: 'Jue',
  5: 'Vie',
  6: 'Sáb',
  7: 'Dom',
}

/** "y N g sin costo" (PM, round 1): never shown for a figure with nothing pending. */
function pendingSuffix(grams: number): string {
  return grams > 0 ? ` y ${formatGrams(grams)} sin costo` : ''
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
        aria-label="Mes anterior"
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
        aria-label="Mes siguiente"
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
          Compras de flores
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
        <span className="rotulo">Vendiste en el mes</span>
        <span className="cifra-xl">{formatMoney(m.sales)}</span>
        <span className="pie">
          {formatGrams(m.grams_sold + m.grams_gifted)}
          {m.average_margin.percent !== null &&
            ` · margen promedio ${m.average_margin.percent}%${pendingSuffix(m.average_margin.pending_grams)}`}
          {m.average_margin.percent === null &&
            m.average_margin.pending_grams > 0 &&
            ` · margen promedio${pendingSuffix(m.average_margin.pending_grams)}`}
        </span>
        {m.shortfall !== null && (
          <span className="pie">
            Faltante de stock {formatMoney(m.shortfall.amount)}
            {pendingSuffix(m.shortfall.pending_grams)}
          </span>
        )}
      </div>

      <span className="pie">{VARIETY_TOTAL_NOTE}</span>
      <span className="pie">Por variedad</span>

      {m.varieties.length === 0 ? (
        <span className="pie">{EMPTY_MONTH_LINE}</span>
      ) : (
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
                {variety.share_percent !== null && <span>{variety.share_percent}% del mes</span>}
                <span>{formatGrams(variety.grams_sold)} vendidos</span>
                <span>{formatGrams(variety.grams_gifted)} regalados</span>
                <span>
                  costo {formatMoney(variety.cost.costed)}
                  {pendingSuffix(variety.cost.pending_grams)}
                </span>
                <span className="analisis__variedad-margen">
                  margen {formatMoney(variety.margin.amount)}
                  {variety.margin.percent !== null && ` (${variety.margin.percent}%)`}
                  {pendingSuffix(variety.margin.pending_grams)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <span className="pie">Semana a semana · últimas 8</span>
      <div className="analisis__semanas">
        {data.weeks.map((week) => (
          <div key={week.first_day} className="analisis__semana">
            <span>{formatDateShort(week.first_day)}</span>
            <Bar value={week.sales} max={maxWeekSales} />
            <span>{formatMoney(week.sales)}</span>
            <span>{formatGrams(week.grams)}</span>
            <span>gastos {formatMoney(week.expenses)}</span>
            <span>
              ganancia {formatMoney(week.profit.amount)}
              {pendingSuffix(week.profit.pending_grams)}
            </span>
            <span>caja {formatMoney(week.cash)}</span>
            {week.best && <span className="analisis__marca-mejor">{BEST_WEEK_MARK}</span>}
          </div>
        ))}
      </div>

      <span className="pie">Mes a mes · últimos 12</span>
      <div className="analisis__meses">
        {data.months.map((row) => (
          <div key={row.month} className="analisis__mes-fila">
            <span>{formatMonthLong(row.month)}</span>
            <span>{formatMoney(row.sales)}</span>
            <span>{formatGrams(row.grams)}</span>
            <span>gastos {formatMoney(row.expenses)}</span>
            <span>
              ganancia {formatMoney(row.profit.amount)}
              {pendingSuffix(row.profit.pending_grams)}
            </span>
            <span>caja {formatMoney(row.cash)}</span>
          </div>
        ))}
      </div>

      <span className="pie">Por día de la semana</span>
      <div className="analisis__dias">
        {data.weekdays.map((day) => (
          <div key={day.weekday} className="analisis__dia">
            <span>{WEEKDAY_LABEL[day.weekday]}</span>
            <Bar value={day.sales} max={maxWeekdaySales} />
            <span>{formatMoney(day.sales)}</span>
            <span>{day.count} ventas</span>
            {day.best && <span className="analisis__marca-mejor">{BEST_WEEKDAY_MARK}</span>}
          </div>
        ))}
      </div>

      {data.since_first_record !== null && (
        <div className="analisis__historico">
          <span className="pie">{SINCE_FIRST_RECORD_LABEL}</span>
          <span>{formatMoney(data.since_first_record.sales)}</span>
          <span>gastos {formatMoney(data.since_first_record.expenses)}</span>
          <span>
            ganancia {formatMoney(data.since_first_record.profit.amount)}
            {pendingSuffix(data.since_first_record.profit.pending_grams)}
          </span>
          <span>caja {formatMoney(data.since_first_record.cash)}</span>
          {data.since_first_record.shortfall !== null && (
            <span>
              Faltante de stock {formatMoney(data.since_first_record.shortfall.amount)}
              {pendingSuffix(data.since_first_record.shortfall.pending_grams)}
            </span>
          )}
        </div>
      )}

      <ExpenseBreakdownView title="Gastos del mes" breakdown={data.month_expenses} />
      <ExpenseBreakdownView
        title="Gastos desde el primer registro"
        breakdown={data.since_first_record_expenses}
      />
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
          <Link to="/mas" aria-label="Volver" className="encabezado__volver">
            ‹
          </Link>
          <span className="encabezado__titulo">Análisis</span>
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
