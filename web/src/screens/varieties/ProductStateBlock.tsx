/**
 * `ProductStateBlock` (`ProductoDetalle.dc.html`; varieties.md, "Rediseño de la página según
 * ProductoDetalle"): where a Product stands, in exactly three rows. Presentational only: it
 * fetches nothing, `VarietyPage` decides when it can be built.
 *
 * Row 1 is the Stock figure with its status by word and shape (an archived Product shows the
 * neutral "Archivada" badge instead), row 2 the price of today or "Sin precio", row 3 the days
 * left and "Oculta" together. `hidden: null` is "not known": nothing is drawn for it, it is never
 * read as "not hidden". The loading shape is the same three rows as neutral bars, through the
 * same frame, so the rows cannot differ in height.
 */

import type { ReactNode } from 'react'
import Insignia from '../../components/Insignia'
import MarcaEstado from '../../components/MarcaEstado'
import type { Status } from '../../api/stock'
import { COMMON_TEXT } from '../../copy/common'
import { VARIETIES_TEXT } from '../../copy/varieties'
import { formatGrams } from '../../format/money'
import { useMoney } from '../../format/moneyContext'
import { NO_PRICE_TODAY, type Variety } from '../Variedades'

type CurrentPrice = Variety['current_price']

export type ProductState =
  | {
      kind: 'active'
      quantity: number
      status: Status
      daysLeft: number | null
      price: CurrentPrice
      hidden: boolean | null
    }
  | { kind: 'archived'; quantity: number; price: CurrentPrice; hidden: boolean | null }

/** The one frame of three rows both the block and its loading shape are drawn in. */
function Rows({
  labelledBy,
  loading,
  rows,
}: {
  labelledBy: string
  loading: boolean
  rows: [ReactNode, ReactNode, ReactNode]
}) {
  return (
    <ul
      className={loading ? 'product-state product-state--loading' : 'product-state'}
      aria-labelledby={labelledBy}
      aria-busy={loading ? 'true' : undefined}
    >
      {rows.map((row, index) => (
        <li key={index} className="product-state__row">
          {row}
        </li>
      ))}
    </ul>
  )
}

function Bar() {
  return <span className="product-state__bar" aria-hidden="true" />
}

export function ProductStateBlockLoading({ labelledBy }: { labelledBy: string }) {
  return <Rows labelledBy={labelledBy} loading rows={[<Bar key="1" />, <Bar key="2" />, <Bar key="3" />]} />
}

export function ProductStateBlock({ labelledBy, state }: { labelledBy: string; state: ProductState }) {
  const money = useMoney()
  const active = state.kind === 'active'
  const price =
    state.price === null
      ? NO_PRICE_TODAY
      : money.keepTogether(COMMON_TEXT.pricePerGram(money.money(state.price.list_price)))
  const daysLeft = state.kind === 'active' ? state.daysLeft : null
  const hasThird = daysLeft !== null || state.hidden === true
  return (
    <Rows
      labelledBy={labelledBy}
      loading={false}
      rows={[
        <>
          <span className="cifra-n">{formatGrams(state.quantity)}</span>
          {active ? <MarcaEstado estado={state.status} /> : <Insignia>{VARIETIES_TEXT.archivada}</Insignia>}
        </>,
        price,
        hasThird ? (
          <>
            {daysLeft !== null && (
              <span className="cifra-n">
                {daysLeft}
                {VARIETIES_TEXT.dias}
              </span>
            )}
            {state.hidden === true && <span className="product-state__oculta">{VARIETIES_TEXT.oculta}</span>}
          </>
        ) : null,
      ]}
    />
  )
}
