/**
 * `SaleCard` at its props seam (`sale`), inside a router and the Business's Money format: what the
 * card shows, the exact accessible name per Payment state (the chip's own words reach it), the link
 * to the sale, and that it holds no date in the name, no VIP badge and no unit.
 */

import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, test } from 'vitest'
import type { Sale, SaleLine } from '../../api/sales'
import { MoneyFormatProvider } from '../../format/MoneyFormatProvider'
import SaleCard from './SaleCard'
import { saleWith } from './saleWith'

function line(name: string, quantity: number, total = 0): SaleLine {
  return {
    product_id: 1,
    product_name: name,
    quantity,
    pricing_rule: 'list',
    customer_type_name: null,
    price_per_gram: 0,
    line_total: total,
  }
}

const ONE_LINE = [line('Blue Dream', 5, 11000)]
const TWO_LINES = [line('Blue Dream', 5, 11000), line('Rosa', 1.5, 3000)]
const THREE_LINES_WITH_GIFT = [...TWO_LINES, line('Gift joint', 1, 0)]

function renderCard(sale: Sale) {
  return render(
    <MemoryRouter>
      <MoneyFormatProvider format={{ symbol: '$', decimals: 0 }}>
        <SaleCard sale={sale} />
      </MoneyFormatProvider>
    </MemoryRouter>,
  )
}

function cardOf(): HTMLElement {
  return screen.getByRole('link')
}

describe('what the card shows', () => {
  test('the date is dd/mm from the sale date, never the clock', () => {
    renderCard(saleWith('paid', { date: '2026-09-14', lines: ONE_LINE }))
    expect(screen.getByText('14/09')).toHaveClass('sale-card__date')
  })

  test('the customer name, or No customer', () => {
    const { unmount } = renderCard(saleWith('paid', { lines: ONE_LINE }))
    expect(screen.getByText('Ana Pérez')).toHaveClass('sale-card__name')
    unmount()
    renderCard(saleWith('paid', { customer: null, lines: ONE_LINE }))
    expect(screen.getByText('No customer')).toHaveClass('sale-card__name')
  })

  test('the first line reads name × quantity with no unit', () => {
    renderCard(saleWith('paid', { lines: TWO_LINES }))
    expect(screen.getByText('Blue Dream × 5')).toHaveClass('sale-card__item')
    expect(cardOf().textContent).not.toMatch(/\bg\b/)
  })

  test('the first line is the one saved first, with a decimal quantity', () => {
    renderCard(saleWith('paid', { lines: [line('Rosa', 1.5), line('Blue Dream', 5)] }))
    expect(screen.getByText('Rosa × 1,5')).toBeInTheDocument()
  })

  test('one line shows no +N more', () => {
    renderCard(saleWith('paid', { lines: ONE_LINE }))
    expect(screen.queryByText(/more/)).not.toBeInTheDocument()
  })

  test('two lines show +1 more', () => {
    renderCard(saleWith('paid', { lines: TWO_LINES }))
    expect(screen.getByText('+1 more')).toHaveClass('sale-card__more')
  })

  test('three lines, one a Gift, show +2 more', () => {
    renderCard(saleWith('paid', { lines: THREE_LINES_WITH_GIFT }))
    expect(screen.getByText('+2 more')).toBeInTheDocument()
  })

  test('the total is the sale total, Shipping included, in the figure class', () => {
    renderCard(saleWith('paid', { total: 11500, shipping_charged: 500, lines: ONE_LINE }))
    const total = screen.getByText('$ 11.500')
    expect(total).toHaveClass('sale-card__total')
    expect(total).toHaveClass('cifra-n')
  })

  test('the chip shows the payment state', () => {
    renderCard(saleWith('unpaid', { lines: ONE_LINE }))
    expect(screen.getByText('Unpaid')).toHaveClass('payment-chip--unpaid')
  })

  test('a VIP customer gets no badge', () => {
    renderCard(saleWith('paid', { customer: { id: 1, name: 'Ana Pérez', vip: true }, lines: ONE_LINE }))
    expect(screen.queryByText(/VIP/i)).not.toBeInTheDocument()
  })

  test('the card is one link to the sale', () => {
    renderCard(saleWith('paid', { id: 10, lines: ONE_LINE }))
    expect(screen.getAllByRole('link')).toHaveLength(1)
    expect(cardOf()).toHaveAttribute('href', '/sales/10')
    expect(cardOf()).toHaveClass('sale-card')
  })
})

describe('the accessible name', () => {
  test.each([
    ['paid', saleWith('paid', { lines: TWO_LINES }), 'Ana Pérez, Blue Dream × 5 +1 more, Paid, total $ 11.000'],
    ['unpaid', saleWith('unpaid', { lines: TWO_LINES }), 'Ana Pérez, Blue Dream × 5 +1 more, Unpaid, total $ 11.000'],
    [
      'part_paid',
      saleWith('part_paid', { lines: TWO_LINES }),
      'Ana Pérez, Blue Dream × 5 +1 more, Part-paid · $ 4.000 owed, total $ 11.000',
    ],
    [
      'null',
      saleWith(null, { lines: TWO_LINES }),
      "Ana Pérez, Blue Dream × 5 +1 more, Payment can't be shown, total $ 11.000",
    ],
  ])('for %s it reads exactly', (_state, sale, name) => {
    renderCard(sale)
    expect(cardOf()).toHaveAccessibleName(name)
  })

  test('with one line and no customer there is no +N more and the noCustomer text leads', () => {
    renderCard(saleWith('paid', { customer: null, lines: ONE_LINE }))
    expect(cardOf()).toHaveAccessibleName('No customer, Blue Dream × 5, Paid, total $ 11.000')
  })

  test.each([
    ['paid', saleWith('paid', { lines: ONE_LINE })],
    ['unpaid', saleWith('unpaid', { lines: ONE_LINE })],
    ['part_paid', saleWith('part_paid', { lines: ONE_LINE })],
    ['null', saleWith(null, { lines: ONE_LINE })],
  ])('for %s it contains the chip text as shown', (_state, sale) => {
    const { container } = renderCard(sale)
    const chipText = container.querySelector('.payment-chip')?.textContent ?? ''
    expect(chipText).not.toBe('')
    expect(cardOf().getAttribute('aria-label')).toContain(chipText)
  })

  test.each([
    ['null', null],
    ['0', 0],
  ])('part_paid with still_owed %s reads Payment can\'t be shown', (_name, owed) => {
    renderCard(saleWith('part_paid', { still_owed: owed, lines: ONE_LINE }))
    expect(cardOf()).toHaveAccessibleName(expect.stringContaining("Payment can't be shown"))
  })

  test('the name holds no date', () => {
    renderCard(saleWith('paid', { date: '2026-09-14', lines: TWO_LINES }))
    expect(cardOf().getAttribute('aria-label')).not.toMatch(/14|09/)
  })
})
