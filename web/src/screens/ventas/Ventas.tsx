/**
 * `Ventas` (`sales.md`, "On screen: Ventas"): Hoy · Semana · Mes · Fechas (the week
 * runs Monday to Sunday), all computed only through `format/dates.ts`'s period
 * helpers from `me.today` (plan, invariants) — never `new Date()`. The period's
 * total and count are the sum and the number of the sales the list itself shows,
 * never a separate figure. Each row's VIP badge is the customer's *current* flag,
 * read straight from the API's answer (docs/adr/0011), not how the sale was priced.
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
import Notice from '../../components/Notice'
import SinConexion from '../../components/SinConexion'
import { type DateRange, formatDate, monthRange, todayRange, weekRange } from '../../format/dates'
import { formatGrams, formatMoney } from '../../format/money'

export type Period = 'hoy' | 'semana' | 'mes' | 'fechas'

export const EMPTY_LIST = 'Todavía no registraste ninguna venta en este período.'

const PERIOD_LABEL: Record<Period, string> = {
  hoy: 'Hoy',
  semana: 'Semana',
  mes: 'Mes',
  fechas: 'Fechas',
}

const PERIODS: Period[] = ['hoy', 'semana', 'mes', 'fechas']

function rangeFor(period: Period, today: string, custom: DateRange): DateRange {
  if (period === 'hoy') return todayRange(today)
  if (period === 'semana') return weekRange(today)
  if (period === 'mes') return monthRange(today)
  return custom
}

function varietiesSummary(lines: Sale['lines']): string {
  return lines.map((line) => `${line.variety_name} ${formatGrams(line.grams)}`).join(' · ')
}

function countLabel(count: number): string {
  return `${count} ${count === 1 ? 'venta' : 'ventas'}`
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
        <span className="encabezado__titulo">Ventas</span>

        {feedback !== null && <Notice kind={feedback.kind} message={feedback.message} />}

        <div className="periodos" role="group" aria-label="Período">
          {PERIODS.map((item) => (
            <button
              key={item}
              type="button"
              className={period === item ? 'periodos__boton periodos__boton--activo' : 'periodos__boton'}
              aria-pressed={period === item}
              onClick={() => setPeriod(item)}
            >
              {PERIOD_LABEL[item]}
            </button>
          ))}
        </div>

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
            <div className="ventas__resumen">
              <span className="cifra-xl">{formatMoney(total)}</span>
              <span className="rotulo">{countLabel(sales.length)}</span>
            </div>

            {sales.length === 0 && <span className="campo__rotulo">{EMPTY_LIST}</span>}

            <div className="lista-ventas">
              {sales.map((sale) => (
                <Link key={sale.id} to={`/ventas/${sale.id}`} className="fila-venta">
                  <span className="fila-venta__fecha">{formatDate(sale.date, me.today)}</span>
                  <span className="fila-venta__cliente">
                    {sale.customer === null ? (
                      <span className="fila-venta__sin-cliente">Sin cliente</span>
                    ) : (
                      <>
                        {sale.customer.name}
                        {sale.customer.vip && <span className="vip-insignia">VIP</span>}
                      </>
                    )}
                  </span>
                  <span className="fila-venta__detalle">{varietiesSummary(sale.lines)}</span>
                  <span className="fila-venta__monto">
                    <span className={sale.still_owing ? 'monto-deuda' : undefined}>
                      {formatMoney(sale.total)}
                    </span>
                    {sale.still_owing && <span className="rotulo">te debe</span>}
                  </span>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  )
}
