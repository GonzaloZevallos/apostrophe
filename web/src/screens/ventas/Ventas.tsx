/**
 * `Ventas` (`sales.md`, "On screen: Ventas"): Hoy · Semana · Mes · Fechas (the week
 * runs Monday to Sunday), all computed only through `format/dates.ts`'s period
 * helpers from `me.today` (plan, invariants) — never `new Date()`. The period's
 * total and count are the sum and the number of the sales the list itself shows,
 * never a separate figure. Each row's VIP badge is the customer's *current* flag,
 * read straight from the API's answer (docs/adr/0011), not how the sale was priced.
 *
 * Rebuilt to `Ventas.dc.html`/`VentasCompu.dc.html` (plan, subtask "sales-list"):
 * the range sits next to the total instead of a standalone oversized figure, and
 * each row is the design's stacked shape — date, name/VIP, distinct variety names
 * with their grams, a row chevron, and the amount with "te debe" under it only
 * when the API's `still_owing` says so. Grams come only from `saleGrams` (plan,
 * invariants: "on Ventas rows from `saleGrams`"), never a row's own sum. On the
 * computer (`min-width: 900px`, `app.css`) the grams move into their own
 * right-aligned column, same as `VentasCompu.dc.html` — the phone's merged
 * "names · N g" text and the compu's name-only/grams-column pair are both always
 * in the DOM, one of the pair hidden by the breakpoint, never recomputed. "7
 * ventas más abajo" (no API field answers it) is left out, same as `NuevaVenta`'s
 * own left-out list.
 */

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useLocation, useOutletContext } from 'react-router'
import { NetworkError } from '../../api/client'
import { keys } from '../../api/keys'
import type { Me } from '../../api/me'
import { listSales, type Sale } from '../../api/sales'
import ErrorGenerico from '../../components/ErrorGenerico'
import { readFeedback } from '../../components/feedback'
import Icono from '../../components/Icono'
import Insignia from '../../components/Insignia'
import Notice from '../../components/Notice'
import Pestanas from '../../components/Pestanas'
import SinConexion from '../../components/SinConexion'
import { salesCount } from '../../format/counts'
import { type DateRange, formatDate, monthRange, todayRange, weekRange } from '../../format/dates'
import { formatGrams, formatMoney } from '../../format/money'
import { saleGrams } from '../../sales/grams'

export type Period = 'hoy' | 'semana' | 'mes' | 'fechas'

export const EMPTY_LIST = 'Todavía no registraste ninguna venta en este período.'

const PERIOD_LABEL: Record<Period, string> = {
  hoy: 'Hoy',
  semana: 'Semana',
  mes: 'Mes',
  fechas: 'Fechas',
}

const PERIODS: Period[] = ['hoy', 'semana', 'mes', 'fechas']

const PESTANA_ITEMS = PERIODS.map((item) => ({ value: item, label: PERIOD_LABEL[item] }))

function rangeFor(period: Period, today: string, custom: DateRange): DateRange {
  if (period === 'hoy') return todayRange(today)
  if (period === 'semana') return weekRange(today)
  if (period === 'mes') return monthRange(today)
  return custom
}

/** `"28/09 – 04/10"`, or the single date when the range is one day (Hoy): the
 * design's own example (`Ventas.dc.html`) only draws a multi-day range, so a
 * same-day range collapsing to one date, rather than repeating it, is this
 * subtask's own call (see "Decisions and assumptions"). */
function rangeLabel(range: DateRange, today: string): string {
  const start = formatDate(range.start, today)
  if (range.start === range.end) return start
  return `${start} – ${formatDate(range.end, today)}`
}

/** Distinct variety names, in the order each first appears (plan, "Rows"). */
function varietyNames(lines: Sale['lines']): string {
  const seen = new Set<string>()
  const names: string[] = []
  for (const line of lines) {
    if (!seen.has(line.variety_name)) {
      seen.add(line.variety_name)
      names.push(line.variety_name)
    }
  }
  return names.join(', ')
}

export default function Ventas() {
  const me = useOutletContext<Me>()
  const location = useLocation()
  const [feedback] = useState(() => readFeedback(location.state))
  const [period, setPeriod] = useState<Period>('hoy')
  const [custom, setCustom] = useState<DateRange>(() => monthRange(me.today))

  const range = rangeFor(period, me.today, custom)

  const { data, isPending, isError, error } = useQuery({
    queryKey: keys.sales(range.start, range.end),
    queryFn: () => listSales(range.start, range.end),
  })

  const sales = data ?? []
  const total = sales.reduce((sum, sale) => sum + sale.total, 0)

  return (
    <main className="pantalla">
      <div className="cuerpo">
        <div className="ventas__cabecera">
          <span className="encabezado__titulo">Ventas</span>

          <Pestanas items={PESTANA_ITEMS} value={period} onChange={setPeriod} ariaLabel="Período" />

          {!isError && !isPending && (
            <div className="ventas__resumen">
              <span className="ventas__rango">{`${rangeLabel(range, me.today)} · ${salesCount(sales.length)}`}</span>
              <span className="ventas__total">{formatMoney(total)}</span>
            </div>
          )}
        </div>

        {feedback !== null && <Notice kind={feedback.kind} message={feedback.message} />}

        {period === 'fechas' && (
          <div className="periodos__fechas">
            <label className="campo">
              <span className="campo__rotulo">Desde</span>
              <input
                className="campo__input"
                type="date"
                aria-label="Desde"
                value={custom.start}
                max={custom.end}
                onChange={(event) =>
                  setCustom((previous) => ({ ...previous, start: event.target.value }))
                }
              />
            </label>
            <label className="campo">
              <span className="campo__rotulo">Hasta</span>
              <input
                className="campo__input"
                type="date"
                aria-label="Hasta"
                value={custom.end}
                min={custom.start}
                onChange={(event) =>
                  setCustom((previous) => ({ ...previous, end: event.target.value }))
                }
              />
            </label>
          </div>
        )}

        {isError && error instanceof NetworkError && <SinConexion />}
        {isError && !(error instanceof NetworkError) && <ErrorGenerico />}

        {!isError && !isPending && (
          <>
            {sales.length === 0 && <span className="campo__rotulo">{EMPTY_LIST}</span>}

            <div className="lista-ventas">
              {sales.map((sale) => {
                const names = varietyNames(sale.lines)
                const gramos = formatGrams(saleGrams(sale.lines))
                return (
                  <Link key={sale.id} to={`/ventas/${sale.id}`} className="fila-venta">
                    <span className="fila-venta__fecha">{formatDate(sale.date, me.today)}</span>
                    <span className="fila-venta__cuerpo">
                      <span className="fila-venta__nombre">
                        {sale.customer === null ? (
                          <span className="fila-venta__sin-cliente">Sin cliente</span>
                        ) : (
                          <>
                            {sale.customer.name}
                            {sale.customer.vip && <Insignia tono="acento">VIP</Insignia>}
                          </>
                        )}
                      </span>
                      {/* Phone: name and grams in one line (`Ventas.dc.html`). */}
                      <span className="fila-venta__detalle fila-venta__detalle--combinada">
                        {`${names} · ${gramos}`}
                      </span>
                      {/* Computer: grams move into their own column below
                          (`VentasCompu.dc.html`), so this line is names only. */}
                      <span className="fila-venta__detalle fila-venta__detalle--nombre">{names}</span>
                    </span>
                    <span className="fila-venta__gramos">{gramos}</span>
                    <span className="fila-venta__monto">
                      <span className={sale.still_owing ? 'fila-venta__cifra monto-deuda' : 'fila-venta__cifra'}>
                        {formatMoney(sale.total)}
                      </span>
                      {sale.still_owing && <span className="fila-venta__te-debe monto-deuda">te debe</span>}
                    </span>
                    <Icono nombre="chevron" size={18} />
                  </Link>
                )
              })}
            </div>
          </>
        )}
      </div>
    </main>
  )
}
