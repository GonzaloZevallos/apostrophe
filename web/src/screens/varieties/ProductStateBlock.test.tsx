/**
 * `ProductStateBlock` and its loading shape at their props seam: three listitems in every case,
 * "not known" drawn as nothing, and whole figures. The list is named by the page's `h1`.
 */

import { render, screen, within } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { STOCK_TEXT } from '../../copy/stock'
import { VARIETIES_TEXT } from '../../copy/varieties'
import { MoneyFormatProvider } from '../../format/MoneyFormatProvider'
import { NO_PRICE_TODAY } from '../Variedades'
import { ProductStateBlock, ProductStateBlockLoading, type ProductState } from './ProductStateBlock'

const PRICE = { id: 3, effective_from: '2026-09-25', list_price: 11000, bulk_price: null, bulk_minimum: null, vip_price: null }
const ACTIVE: ProductState = { kind: 'active', quantity: 30, status: 'ok', daysLeft: 12, price: PRICE, hidden: false }

function draw(node: React.ReactNode): HTMLElement {
  render(
    <MoneyFormatProvider format={{ symbol: '$', decimals: 0 }}>
      <h1 id="name">24K Gold</h1>
      {node}
    </MoneyFormatProvider>,
  )
  return screen.getByRole('list', { name: '24K Gold' })
}

function block(state: ProductState): { list: HTMLElement; rows: [HTMLElement, HTMLElement, HTMLElement] } {
  const list = draw(<ProductStateBlock labelledBy="name" state={state} />)
  const items = within(list).getAllByRole('listitem')
  expect(items).toHaveLength(3)
  const [first, second, third] = items
  if (first === undefined || second === undefined || third === undefined) throw new Error('three rows expected')
  return { list, rows: [first, second, third] }
}

describe('ProductStateBlock', () => {
  test('an active Product that is hidden shows Stock, status, price, days left and Hidden', () => {
    const { rows } = block({ ...ACTIVE, hidden: true })
    expect(rows[0]).toHaveTextContent(STOCK_TEXT.statusOk)
    expect(rows[1]).toHaveTextContent(/11.000 x g/)
    expect(rows[2]).toHaveTextContent(`12${VARIETIES_TEXT.dias}`)
    expect(rows[2]).toHaveTextContent(VARIETIES_TEXT.oculta)
  })

  test('no price shows "No price"', () => {
    const { rows } = block({ ...ACTIVE, price: null })
    expect(rows[1]).toHaveTextContent(NO_PRICE_TODAY)
  })

  test('days left null shows no Days left', () => {
    const { rows } = block({ ...ACTIVE, daysLeft: null, hidden: true })
    expect(rows[2]).not.toHaveTextContent(VARIETIES_TEXT.dias)
    expect(rows[2]).toHaveTextContent(VARIETIES_TEXT.oculta)
  })

  test('with neither days left nor Hidden the third row has no content at all', () => {
    const { rows } = block({ ...ACTIVE, daysLeft: null, hidden: false })
    expect(rows[2].textContent).toBe('')
    expect(rows[2].childNodes).toHaveLength(0)
  })

  test('hidden null means not known: no Hidden is drawn', () => {
    const { list } = block({ ...ACTIVE, hidden: null })
    expect(list).not.toHaveTextContent(VARIETIES_TEXT.oculta)
  })

  test('an archived Product shows Archived and Hidden, and no status or days left', () => {
    const { rows } = block({ kind: 'archived', quantity: -5, price: PRICE, hidden: true })
    expect(rows[0]).toHaveTextContent(VARIETIES_TEXT.archivada)
    expect(rows[0]).toHaveTextContent('-5')
    expect(rows[0]).not.toHaveTextContent(STOCK_TEXT.statusOk)
    expect(rows[2]).toHaveTextContent(VARIETIES_TEXT.oculta)
    expect(rows[2]).not.toHaveTextContent(VARIETIES_TEXT.dias)
  })

  test('an archived Product that is not hidden has an empty third row', () => {
    const { rows } = block({ kind: 'archived', quantity: 0, price: null, hidden: false })
    expect(rows[1]).toHaveTextContent(NO_PRICE_TODAY)
    expect(rows[2].textContent).toBe('')
    expect(rows[2].childNodes).toHaveLength(0)
  })

  test('a nine-digit price and a large Stock are each whole in one element', () => {
    const { rows } = block({ ...ACTIVE, quantity: 123456789, price: { ...PRICE, list_price: 987654321 } })
    expect(within(rows[0]).getByText(/123.?456.?789/)).toBeInTheDocument()
    expect(within(rows[1]).getByText(/987.?654.?321/)).toBeInTheDocument()
  })
})

describe('ProductStateBlockLoading', () => {
  test('is busy, has three listitems and shows no figure, currency or Hidden', () => {
    const list = draw(<ProductStateBlockLoading labelledBy="name" />)
    expect(list).toHaveAttribute('aria-busy', 'true')
    expect(within(list).getAllByRole('listitem')).toHaveLength(3)
    expect(list.textContent).toBe('')
    expect(list).not.toHaveTextContent(/\d|\$/)
    expect(list).not.toHaveTextContent(VARIETIES_TEXT.oculta)
  })

  test('the settled block is not busy', () => {
    const { list } = block(ACTIVE)
    expect(list).not.toHaveAttribute('aria-busy')
  })
})
