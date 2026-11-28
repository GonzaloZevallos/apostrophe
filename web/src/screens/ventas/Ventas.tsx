/**
 * `Ventas` (`sales.md`, "On screen: Sales"): Hoy · Semana · Mes · Fechas (the week
 * runs Monday to Sunday), all computed only through `format/dates.ts`'s period
 * helpers from `me.today` (plan, invariants) — never `new Date()`. The period's
 * total and count are the sum and the number of the sales the list itself shows,
 * never a separate figure.
 *
 * The list is one `SaleCard` per sale, at every width. What a card shows, and how it
 * reads the Payment state, is owned by `docs/product/payment-state.md`: this screen
 * reads none of a sale's payment fields, grams or customer flags itself.
 */

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useLocation, useOutletContext } from 'react-router'
import SettingsAvatar from '../../components/SettingsAvatar'
import { NetworkError } from '../../api/client'
import { keys } from '../../api/keys'
import type { Me } from '../../api/me'
import { listSales } from '../../api/sales'
import ErrorGenerico from '../../components/ErrorGenerico'
import { readFeedback } from '../../components/feedback'
import Loading from '../../components/Loading'
import Notice from '../../components/Notice'
import { type FixedValue, SALES_PERIODS } from '../../components/fixedSets'
import Pestanas from '../../components/Pestanas'
import SinConexion from '../../components/SinConexion'
import { salesCount } from '../../format/counts'
import { type DateRange, formatDate, monthRange, todayRange, weekRange } from '../../format/dates'
import { useMoney } from '../../format/moneyContext'
import { SALES_TEXT } from '../../copy/sales'
import { useTranslation } from 'react-i18next'
import SaleCard from './SaleCard'
import { EMPTY_STATE_KEYS } from '../../copy/emptyStates'
import { useViewport } from '../../shell/useViewport'
import { COMMON_TEXT } from '../../copy/common'
import ContentArea from '../../components/ContentArea'

export type Period = FixedValue<typeof SALES_PERIODS>

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

export default function Ventas() {
  const money = useMoney()
  const { t } = useTranslation()
  const me = useOutletContext<Me>()
  const location = useLocation()
  const [feedback] = useState(() => readFeedback(location.state))
  const [period, setPeriod] = useState<Period>('hoy')
  const [custom, setCustom] = useState<DateRange>(() => monthRange(me.today))
  // The phone's equal-cells fit is opt-in; the computer keeps `VentasCompu`'s plain tab list.
  const computer = useViewport() === 'computer'

  const range = rangeFor(period, me.today, custom)

  const { data, isPending, isError, error } = useQuery({
    queryKey: keys.sales(range.start, range.end),
    queryFn: () => listSales(range.start, range.end),
  })

  const sales = data ?? []
  const total = sales.reduce((sum, sale) => sum + sale.total, 0)

  return (
    <ContentArea as="main" className="pantalla">
      <div className="cuerpo">
        <div className="ventas__cabecera">
          <div className="cabecera-fila cabecera-fila--envoltura">
            <span className="encabezado__titulo">{COMMON_TEXT.sales}</span>
            <SettingsAvatar />
          </div>

          <Pestanas
            items={SALES_PERIODS}
            value={period}
            onChange={setPeriod}
            ariaLabel={COMMON_TEXT.period}
            ajuste={computer ? undefined : 'celdas'}
          />

          {!isError && !isPending && (
            <div className="ventas__resumen">
              <span className="ventas__rango">{`${rangeLabel(range, me.today)} · ${salesCount(t, sales.length)}`}</span>
              <span className="ventas__total cifra-s">{money.money(total)}</span>
            </div>
          )}
        </div>

        {feedback !== null && <Notice {...feedback} />}

        {period === 'fechas' && (
          <div className="periodos__fechas">
            <label className="campo">
              <span className="campo__rotulo">{SALES_TEXT.from}</span>
              <input
                className="campo__input"
                type="date"
                aria-label={SALES_TEXT.from}
                value={custom.start}
                max={custom.end}
                onChange={(event) =>
                  setCustom((previous) => ({ ...previous, start: event.target.value }))
                }
              />
            </label>
            <label className="campo">
              <span className="campo__rotulo">{SALES_TEXT.to}</span>
              <input
                className="campo__input"
                type="date"
                aria-label={SALES_TEXT.to}
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

        {isPending && <Loading />}

        {!isError && !isPending && (
          <>
            {sales.length === 0 && <span className="campo__rotulo" data-copy="emptyLine">
                {t(EMPTY_STATE_KEYS.salesList)}
              </span>}

            <div className="sale-card-list">
              {sales.map((sale) => (
                <SaleCard key={sale.id} sale={sale} />
              ))}
            </div>
          </>
        )}
      </div>
    </ContentArea>
  )
}
