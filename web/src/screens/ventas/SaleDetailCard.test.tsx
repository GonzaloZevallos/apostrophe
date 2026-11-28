/**
 * `SaleDetailCard` at its props seam, under the Business's Money format: the rows and their one
 * shape, the badge per rule, Shipping and the Note, the price without a unit, and the figures and
 * the truncating name under a 60-character name and nine-digit amounts.
 */

import { render, screen, within } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import type { SaleLine } from '../../api/sales'
import { MoneyFormatProvider } from '../../format/MoneyFormatProvider'
import { moneyFormatter } from '../../format/money'
import SaleDetailCard, { type SaleDetailCardProps } from './SaleDetailCard'

const FORMAT = { symbol: '$', decimals: 0 }
const money = moneyFormatter(FORMAT)

function lineWith(overrides: Partial<SaleLine> = {}): SaleDetailCardProps['lines'][number] {
  return {
    product_name: 'Blue Dream',
    quantity: 5,
    price_per_gram: 2000,
    pricing_rule: 'list',
    customer_type_name: null,
    line_total: 10000,
    ...overrides,
  }
}

function renderCard(props: Partial<SaleDetailCardProps> = {}) {
  return render(
    <MoneyFormatProvider format={FORMAT}>
      <SaleDetailCard lines={[lineWith()]} shipping_charged={0} total={10000} note={null} {...props} />
    </MoneyFormatProvider>,
  )
}

describe('the rows', () => {
  test('the section is labelled by the Detail heading, with one item per line', () => {
    renderCard({ lines: [lineWith(), lineWith({ product_name: 'Rosa' })] })
    const section = screen.getByRole('region', { name: 'Detail' })
    expect(within(section).getByRole('heading', { level: 2, name: 'Detail' })).toBeInTheDocument()
    expect(within(section).getAllByRole('listitem')).toHaveLength(2)
  })

  test('a row reads quantity, name, price and total in that order, the price with no unit', () => {
    renderCard()
    const row = screen.getByRole('listitem')
    const parts = Array.from(row.children).map((child) => child.textContent)
    expect(parts).toEqual(['5 g ×', 'Blue Dream', `· ${money.money(2000)}`, money.money(10000)])
    expect(row.textContent).not.toMatch(/per gram|\/ ?g\b|por gramo/i)
  })

  test('the quantity, price and total are figures; the total is the small figure', () => {
    renderCard()
    expect(screen.getByText('5 g ×')).toHaveClass('cifra-n')
    expect(screen.getByText(`· ${money.money(2000)}`)).toHaveClass('cifra-n')
    expect(screen.getByText(money.money(10000), { selector: 'li span' })).toHaveClass('cifra-s')
  })
})

describe('the badge', () => {
  test.each([
    ['list', null, null],
    ['bulk', null, 'bulk'],
    ['gift', null, 'gift'],
    ['special', null, 'special'],
    ['type', 'Mayoristas', 'Mayoristas'],
    ['vip', null, 'VIP'],
  ] as const)('a %s line shows %s', (rule, typeName, word) => {
    renderCard({ lines: [lineWith({ pricing_rule: rule, customer_type_name: typeName })] })
    const row = screen.getByRole('listitem')
    expect(row.children).toHaveLength(word === null ? 4 : 5)
    if (word !== null) {
      expect(within(row).getByText(word)).toBeInTheDocument()
    }
    expect(within(row).queryByText('list')).not.toBeInTheDocument()
  })

  test('every row has the same shape, the badge sits before the total', () => {
    renderCard({ lines: [lineWith({ pricing_rule: 'gift', line_total: 0 })] })
    const row = screen.getByRole('listitem')
    const parts = Array.from(row.children).map((child) => child.textContent)
    expect(parts).toEqual(['5 g ×', 'Blue Dream', `· ${money.money(2000)}`, 'gift', money.money(0)])
  })
})

describe('shipping, total and note', () => {
  test('Shipping is hidden at 0', () => {
    renderCard({ shipping_charged: 0 })
    expect(screen.queryByText('Shipping charged')).not.toBeInTheDocument()
    expect(screen.getByText('Total')).toBeInTheDocument()
  })

  test('Shipping shows above 0 with its figure', () => {
    renderCard({ shipping_charged: 500 })
    expect(screen.getByText('Shipping charged')).toBeInTheDocument()
    expect(screen.getByText(money.money(500))).toHaveClass('sale-detail-card__figure')
  })

  test('the Total is in the big figure', () => {
    renderCard({ total: 12345 })
    expect(screen.getByText(money.money(12345))).toHaveClass('cifra-xl')
  })

  test('the Note is shown, and a blank one shows nothing', () => {
    const { unmount } = renderCard({ note: 'Leave at the door' })
    expect(screen.getByText('Leave at the door').tagName).toBe('P')
    unmount()
    const { container } = renderCard({ note: '   ' })
    expect(container.querySelector('p')).toBeNull()
  })

  test('a null note shows nothing', () => {
    const { container } = renderCard({ note: null })
    expect(container.querySelector('p')).toBeNull()
  })
})

describe('a long name and big figures', () => {
  test('the name carries the truncating class and each figure is one node', () => {
    const name = 'N'.repeat(60)
    renderCard({
      lines: [lineWith({ product_name: name, price_per_gram: 123456789, line_total: 987654321 })],
      shipping_charged: 111222333,
      total: 444555666,
    })
    expect(screen.getByText(name)).toHaveClass('sale-detail-card__name')
    for (const text of [
      `· ${money.money(123456789)}`,
      money.money(987654321),
      money.money(111222333),
      money.money(444555666),
    ]) {
      expect(screen.getByText(text)).toHaveClass('sale-detail-card__figure')
    }
    expect(screen.getByText(name)).not.toHaveClass('sale-detail-card__figure')
  })
})
