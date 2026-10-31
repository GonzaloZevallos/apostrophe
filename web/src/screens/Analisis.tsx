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

import { useId, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useOutletContext } from 'react-router'
import { NetworkError } from '../api/client'
import {
  type Analysis,
  type AnalysisMonth,
  type ExpenseBreakdown as ExpenseBreakdownT,
  readAnalysis,
} from '../api/analysis'
import { keys } from '../api/keys'
import type { Me } from '../api/me'
import { formatMonthLong } from '../format/dates'
import { formatGrams, formatMoney } from '../format/money'
import Loading from '../components/Loading'
import ErrorGenerico from '../components/ErrorGenerico'
import SinConexion from '../components/SinConexion'
import { amountParts } from './analisisCost'
import AmountRow from './analisis/AmountRow'
import { WithdrawalLines } from './analisis/CostLines'
import { pendingSuffix } from './analisis/pendingSuffix'
import Bar from './analisis/Bar'
import NoBestWeekLine from './analisis/NoBestWeekLine'
import { BEST_WEEKDAY_MARK, BEST_WEEK_MARK, BEST_WEEK_TABLE_MARK } from './analisis/marks'
import { TablaMeses, TablaSemanas, TablaVariedades } from './AnalisisTablas'
import { TarjetasMeses, TarjetasSemanas, TarjetasVariedades } from './AnalisisTarjetas'
import { useViewport } from '../shell/useViewport'
import {
  COST_OF_GOODS_LABEL,
  NO_BEST_WEEK_LINE,
  OWN_USE_LABEL,
  PROMOTION_LABEL,
  PURCHASES_NOTE,
  SHORTFALL_LABEL,
  SINCE_FIRST_RECORD_LABEL,
  VARIETY_TOTAL_NOTE, ANALYSIS_TEXT,
} from '../copy/analysis'
import { useTranslation } from 'react-i18next'
import { EMPTY_STATE_KEYS } from '../copy/emptyStates'
import { COMMON_TEXT } from '../copy/common'

export {
  COST_OF_GOODS_LABEL,
  NO_BEST_WEEK_LINE,
  OWN_USE_LABEL,
  PROMOTION_LABEL,
  PURCHASES_NOTE,
  SHORTFALL_LABEL,
  SINCE_FIRST_RECORD_LABEL,
  VARIETY_TOTAL_NOTE,
}
export { BEST_WEEKDAY_MARK, BEST_WEEK_MARK, BEST_WEEK_TABLE_MARK, NoBestWeekLine }

const WEEKDAY_LABEL: Record<number, string> = {
  1: ANALYSIS_TEXT.lun,
  2: ANALYSIS_TEXT.mar,
  3: ANALYSIS_TEXT.mie,
  4: ANALYSIS_TEXT.jue,
  5: ANALYSIS_TEXT.vie,
  6: ANALYSIS_TEXT.sab,
  7: ANALYSIS_TEXT.dom,
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
        aria-label={COMMON_TEXT.previousMonth}
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
        aria-label={COMMON_TEXT.nextMonth}
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
          {COMMON_TEXT.flowerPurchases}
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
  const { t } = useTranslation()
  const m = data.month
  const phone = useViewport() === 'phone'
  const ids = useId()
  const heroId = `${ids}-hero`
  const historyLabelId = `${ids}-history`
  const maxWeekdaySales = Math.max(0, ...data.weekdays.map((day) => day.sales))

  return (
    <>
      <MonthNav month={m} onMonth={onMonth} />

      <div>
        <div role="group" aria-labelledby={heroId}>
          <span id={heroId} className="rotulo">
            {ANALYSIS_TEXT.vendisteEnElMes}
          </span>
          <span className="cifra-xl analisis__monto-cifra">{formatMoney(m.sales)}</span>
        </div>
        <span className="pie">
          <span className="analisis__monto-cifra">{formatGrams(m.quantity_sold)}</span>
          {ANALYSIS_TEXT.vendidos}
          <span className="analisis__monto-cifra">{formatGrams(m.quantity_gifted)}</span>
          {ANALYSIS_TEXT.regalados}
          {(m.average_margin.percent !== null || m.average_margin.pending_quantity > 0) &&
            ANALYSIS_TEXT.margenPromedio}
          {m.average_margin.percent !== null && (
            <>
              {' '}
              <span className="analisis__monto-cifra">
                {ANALYSIS_TEXT.porcentaje(m.average_margin.percent)}
              </span>
            </>
          )}
          {m.average_margin.pending_quantity > 0 && (
            <span className="analisis__monto-marca">
              {pendingSuffix(m.average_margin.pending_quantity)}
            </span>
          )}
        </span>
        <WithdrawalLines
          variant="row"
          shortfall={m.shortfall}
          promotion={m.promotion}
          ownUse={m.own_use}
        />
      </div>

      <span className="pie">{VARIETY_TOTAL_NOTE}</span>

      {/* `AnalisisCompu.dc.html`: a main column (variety table, weeks, months) next
         to an aside (weekdays, since the first record, both expense breakdowns),
         wrapping side by side at computer width (`.analisis__columnas` in
         `app.css`) and stacking on the phone. The tables (computer) and the cards
         (phone) are never both in the DOM: `useViewport()` picks one. */}
      <div className="analisis__columnas">
        <div className="analisis__principal">
          <span className="pie">{ANALYSIS_TEXT.porVariedad}</span>
          {m.products.length === 0 && <span className="pie">{t(EMPTY_STATE_KEYS.analysisEmptyMonth)}</span>}
          {m.products.length > 0 &&
            (phone ? (
              <TarjetasVariedades products={m.products} />
            ) : (
              <TablaVariedades products={m.products} />
            ))}

          <span className="pie">{ANALYSIS_TEXT.semanaASemanaUltimas}</span>
          {phone ? (
            <TarjetasSemanas weeks={data.weeks} />
          ) : (
            <TablaSemanas weeks={data.weeks} ids={ids} />
          )}

          <span className="pie">{ANALYSIS_TEXT.mesAMesUltimos}</span>
          {phone ? (
            <TarjetasMeses months={data.months} />
          ) : (
            <TablaMeses months={data.months} ids={ids} />
          )}
        </div>

        <aside className="analisis__aside">
          <span className="pie">{ANALYSIS_TEXT.porDiaDeLa}</span>
          <div className="analisis__dias">
            {data.weekdays.map((day) => (
              <div key={day.weekday} className="analisis__dia">
                <span>{WEEKDAY_LABEL[day.weekday]}</span>
                <Bar value={day.sales} max={maxWeekdaySales} />
                <span className="analisis__dia-cifra">{formatMoney(day.sales)}</span>
                <span>{day.count}{ANALYSIS_TEXT.ventas}</span>
                {day.best && <span className="analisis__marca-mejor">{BEST_WEEKDAY_MARK}</span>}
              </div>
            ))}
          </div>

          {data.since_first_record !== null && (
            <div role="group" aria-labelledby={historyLabelId} className="analisis__historico">
              <span id={historyLabelId} className="pie">
                {SINCE_FIRST_RECORD_LABEL}
              </span>
              <AmountRow
                variant="row"
                label={COMMON_TEXT.sales}
                value={amountParts(data.since_first_record.sales, 0)}
              />
              <AmountRow
                variant="row"
                label={COMMON_TEXT.expenses}
                value={amountParts(data.since_first_record.expenses, 0)}
              />
              <AmountRow
                variant="row"
                label={COMMON_TEXT.profit}
                value={amountParts(
                  data.since_first_record.profit.amount,
                  data.since_first_record.profit.pending_quantity,
                )}
              />
              <AmountRow
                variant="row"
                label={COMMON_TEXT.cash}
                value={amountParts(data.since_first_record.cash, 0)}
              />
              <WithdrawalLines
                variant="row"
                shortfall={data.since_first_record.shortfall}
                promotion={data.since_first_record.promotion}
                ownUse={data.since_first_record.own_use}
              />
            </div>
          )}

          <ExpenseBreakdownView title={ANALYSIS_TEXT.gastosDelMes} breakdown={data.month_expenses} />
          <ExpenseBreakdownView
            title={ANALYSIS_TEXT.gastosDesdeElPrimer}
            breakdown={data.since_first_record_expenses}
          />
        </aside>
      </div>
    </>
  )
}

export default function Analisis() {
  const { t } = useTranslation()
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
    <main className="pantalla analisis">
      <div className="cuerpo">
        <div className="encabezado__fila">
          <span className="encabezado__titulo">{COMMON_TEXT.analysis}</span>
        </div>

        {query.isPending && <Loading />}

        {query.isError && query.error instanceof NetworkError && <SinConexion />}
        {query.isError && !(query.error instanceof NetworkError) && <ErrorGenerico />}

        {query.data !== undefined && query.data.first_record === null && (
          <span className="pie">{t(EMPTY_STATE_KEYS.analysisNoHistory)}</span>
        )}

        {query.data !== undefined && query.data.first_record !== null && (
          <AnalisisContenido data={query.data} onMonth={setMonth} />
        )}
      </div>
    </main>
  )
}
