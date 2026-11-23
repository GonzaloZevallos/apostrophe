/**
 * `OwedSummary` and its skeleton at the component seam (CODING_STANDARDS §10): Testing Library,
 * handed the answered debtors read as Clientes does. The Total owed and each legend line are found
 * by role and accessible name; every amount is the API's own, written by the money formatter, and
 * nothing here adds, compares or converts one. It is also the test of the census entries of the
 * bar parts and of the "Over 30 days" amount (`colorCensus.ts`): each legend line names its part.
 */

import { render, screen, within } from '@testing-library/react'
import { expect, test } from 'vitest'
import { MoneyFormatProvider } from '../../format/MoneyFormatProvider'
import type { MoneyFormat } from '../../format/money'
import { debtorsOf } from '../../test/debtors'
import type { Debtors } from '../../api/payments'
import { figureChOf } from './figureCh'
import OwedSummary, { OwedSummarySkeleton } from './OwedSummary'

const BUCKETS = { this_week: 12800, days_8_30: 20100, over_30: 24900 }
const SUMMARY: Debtors = debtorsOf({ total_owed: 57800, buckets: BUCKETS })

function renderWith(node: React.ReactNode, format: MoneyFormat = { symbol: '$', decimals: 0 }) {
  return render(<MoneyFormatProvider format={format}>{node}</MoneyFormatProvider>)
}

test('the section is named and its Total owed group shows the API total_owed', () => {
  renderWith(<OwedSummary debtors={SUMMARY} />)

  const region = screen.getByRole('region', { name: 'Summary of what customers owe' })
  const total = within(region).getByRole('group', { name: 'Total owed' })
  expect(total).toHaveTextContent(/^Total owed\s*\$ 57\.800$/)
})

test('the legend is three lines in the fixed order, each named by its word and holding its own amount', () => {
  renderWith(<OwedSummary debtors={SUMMARY} />)

  const lines = within(screen.getByRole('list')).getAllByRole('listitem')
  expect(lines.map((line) => line.getAttribute('aria-labelledby') && line.textContent)).toEqual([
    'This week$ 12.800',
    '8–30 days$ 20.100',
    'Over 30 days$ 24.900',
  ])
  expect(screen.getByRole('listitem', { name: 'This week' })).toHaveTextContent(/\$ 12\.800$/)
  expect(screen.getByRole('listitem', { name: '8–30 days' })).toHaveTextContent(/\$ 20\.100$/)
  expect(screen.getByRole('listitem', { name: 'Over 30 days' })).toHaveTextContent(/\$ 24\.900$/)
})

test('a $0 bucket keeps its legend line with its own $ 0', () => {
  renderWith(<OwedSummary debtors={debtorsOf({ total_owed: 33000, buckets: { this_week: 12800, days_8_30: 0, over_30: 20200 } })} />)

  expect(screen.getAllByRole('listitem')).toHaveLength(3)
  expect(screen.getByRole('listitem', { name: '8–30 days' })).toHaveTextContent(/8–30 days\s*\$ 0$/)
})

test('a $0 Over 30 days keeps its line too', () => {
  renderWith(<OwedSummary debtors={debtorsOf({ total_owed: 100, buckets: { this_week: 100, days_8_30: 0, over_30: 0 } })} />)

  expect(screen.getByRole('listitem', { name: 'Over 30 days' })).toHaveTextContent(/Over 30 days\s*\$ 0$/)
})

test('the bar is hidden from assistive technology and each part carries its API amount as --amount', () => {
  const { container } = renderWith(
    <OwedSummary debtors={debtorsOf({ total_owed: 0.5, buckets: { this_week: 0.3, days_8_30: 0.2, over_30: 0 } })} />,
  )

  const bar = container.querySelector('[aria-hidden="true"]')
  expect(bar).not.toBeNull()
  const parts = Array.from(bar?.children ?? [])
  expect(parts.map((part) => part.getAttribute('style'))).toEqual(['--amount: 0.3;', '--amount: 0.2;', '--amount: 0;'])
  expect(within(bar as HTMLElement).queryByText(/./)).not.toBeInTheDocument()
})

test('the card root carries --figure-ch from the Money format alone', () => {
  const { container } = renderWith(<OwedSummary debtors={SUMMARY} />, { symbol: '$', decimals: 2 })

  expect(screen.getByRole('region').getAttribute('style')).toBe('--figure-ch: 17;')
  expect(container.querySelectorAll('[style*="--figure-ch"]')).toHaveLength(1)
})

test('--figure-ch spans two symbols, the space, nine digits with their dots and the decimals', () => {
  expect(figureChOf({ symbol: '$', decimals: 0 })).toBe(14)
  expect(figureChOf({ symbol: '$', decimals: 2 })).toBe(17)
  expect(figureChOf({ symbol: 'US$$', decimals: 0 })).toBe(20)
  expect(figureChOf({ symbol: '€', decimals: 0 })).toBe(14)
  expect(figureChOf({ symbol: '😀', decimals: 3 })).toBe(18)
})

test('the skeleton is hidden, has no text, digit, currency symbol, role or name and shows the card’s own parts', () => {
  const { container } = renderWith(<OwedSummarySkeleton />)

  const root = container.firstElementChild
  expect(root).toHaveAttribute('aria-hidden', 'true')
  expect(root).not.toHaveAttribute('role')
  expect(root).not.toHaveAttribute('aria-label')
  expect(container.textContent).toBe('')
  expect(container.innerHTML).not.toContain('$')
  expect(screen.queryByRole('region')).not.toBeInTheDocument()
  expect(screen.queryByRole('group')).not.toBeInTheDocument()
  expect(screen.queryByRole('list')).not.toBeInTheDocument()
  expect(root?.getAttribute('style')).toBe('--figure-ch: 14;')
})
