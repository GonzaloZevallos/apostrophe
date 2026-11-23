/**
 * `SalePaymentChip` at its props seam (`state`, `stillOwed`), under the Business's Money format:
 * what the seller reads for each Payment state, that the amount is exactly `still_owed`, and that
 * an unusable state or amount reads "Payment cannot be shown" and never $ 0.
 */

import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'vitest'
import type { Sale } from '../../api/sales'
import enXaSales from '../../copy/locales/en-XA/sales.json'
import { applyShownLanguage, resetToBootLanguage } from '../../i18n/language'
import { addFixtureNamespace, removeFixtureNamespace } from '../../i18n/testing'
import { MoneyFormatProvider } from '../../format/MoneyFormatProvider'
import SalePaymentChip from './SalePaymentChip'
import { saleWith } from './saleWith'

const UNKNOWN = "Payment cannot be shown"

function renderChip(sale: Pick<Sale, 'payment_state' | 'still_owed'>, decimals = 0) {
  return render(
    <MoneyFormatProvider format={{ symbol: '$', decimals }}>
      <SalePaymentChip state={sale.payment_state} stillOwed={sale.still_owed} />
    </MoneyFormatProvider>,
  )
}

function chipOf(name: string | RegExp): HTMLElement {
  return screen.getByText(name).closest('span.payment-chip') as HTMLElement
}

afterEach(() => {
  resetToBootLanguage()
  removeFixtureNamespace('sales', 'en-XA')
})

describe('the four states', () => {
  test('paid reads "Paid" in the paid class', () => {
    renderChip(saleWith('paid'))
    expect(chipOf('Paid')).toHaveClass('payment-chip--paid')
  })

  test('unpaid reads "Unpaid" in the unpaid class', () => {
    renderChip(saleWith('unpaid'))
    expect(chipOf('Unpaid')).toHaveClass('payment-chip--unpaid')
  })

  test('part_paid reads the whole sentence with the amount in the figure class and a decorative circle', () => {
    const { container } = renderChip(saleWith('part_paid'))
    const chip = chipOf(/Part-paid/)
    expect(chip).toHaveClass('payment-chip--part-paid')
    expect(chip).toHaveTextContent('Part-paid · $ 4.000 owed')
    const amount = screen.getByText('$ 4.000')
    expect(amount).toHaveClass('cifra-n')
    expect(chip.textContent).toBe('Part-paid · $ 4.000 owed')
    const half = container.querySelector('.payment-chip__half')
    expect(half).toHaveAttribute('aria-hidden', 'true')
  })

  test('part_paid shows still_owed even when it disagrees with the total', () => {
    renderChip(saleWith('part_paid', { total: 500, still_owed: 7000 }))
    expect(screen.getByText('$ 7.000')).toHaveClass('cifra-n')
    expect(screen.queryByText('$ 500')).not.toBeInTheDocument()
  })

  test('null reads the unknown line with a decorative icon', () => {
    const { container } = renderChip(saleWith(null))
    const chip = chipOf(UNKNOWN)
    expect(chip).toHaveClass('payment-chip--unknown')
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })
})

describe('an unusable state or amount', () => {
  test.each([
    ['null', null],
    ['0', 0],
    ['negative', -5],
    ['0.4 at 0 decimals, which shows as zero', 0.4],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
  ])('part_paid with still_owed %s reads the unknown line and never $ 0', (_name, owed) => {
    renderChip(saleWith('part_paid', { still_owed: owed }))
    expect(chipOf(UNKNOWN)).toHaveClass('payment-chip--unknown')
    expect(screen.queryByText(/Part-paid/)).not.toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/\$ 0/)
  })

  test('an unknown state value reads the unknown line', () => {
    renderChip({ payment_state: 'refunded' as unknown as Sale['payment_state'], still_owed: 100 })
    expect(chipOf(UNKNOWN)).toHaveClass('payment-chip--unknown')
  })
})

describe('in the Test locale', () => {
  test('the amount stays intact inside the figure span', async () => {
    addFixtureNamespace('sales', enXaSales, 'en-XA')
    await act(async () => {
      await applyShownLanguage('en-XA')
    })
    renderChip(saleWith('part_paid'))
    const chip = await screen.findByText(/Ṗåřť-ṗåìđ/)
    const amount = screen.getByText('$ 4.000')
    expect(amount).toHaveClass('cifra-n')
    expect(chip.textContent).toContain('öŵèđ')
  })
})
