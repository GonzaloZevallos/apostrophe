/** `SaleInProgressStrip` rendered with Testing Library: the one button over the sale in progress. */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { SALES_TEXT } from '../../copy/sales'
import { MoneyFormatProvider } from '../../format/MoneyFormatProvider'
import SaleInProgressStrip from './SaleInProgressStrip'

function renderStrip(props: { n: number; total: number; repricing: boolean }, onBack = vi.fn()) {
  render(
    <MoneyFormatProvider format={{ symbol: '$', decimals: 0 }}>
      <SaleInProgressStrip
        words={{
          saleInProgress: SALES_TEXT.saleInProgress,
          back: SALES_TEXT.back,
          products: SALES_TEXT.products(props.n),
          name: (amount) => SALES_TEXT.saleInProgressName(SALES_TEXT.products(props.n), amount),
        }}
        total={props.total}
        repricing={props.repricing}
        onBack={onBack}
      />
    </MoneyFormatProvider>,
  )
  return onBack
}

test('reads the products, the total and Back, and goes back on a tap', async () => {
  const onBack = renderStrip({ n: 2, total: 11000, repricing: false })
  const strip = screen.getByRole('button', { name: 'Sale in progress, 2 products, $ 11.000. Back' })
  expect(strip).toHaveTextContent('Sale in progress · 2 products ·')
  expect(strip).toHaveTextContent('Back')
  await userEvent.click(strip)
  expect(onBack).toHaveBeenCalledTimes(1)
})

test('the total is its own figure element, outside the label', () => {
  renderStrip({ n: 2, total: 11000, repricing: false })
  const figure = screen.getByText('$ 11.000')
  expect(figure).toHaveClass('cifra-s')
  const label = screen.getByText(/Sale in progress/)
  expect(label).not.toContainElement(figure)
  expect(label).not.toHaveTextContent('$')
  expect(screen.getByText('Back')).not.toContainElement(figure)
})

test('a total of zero is shown, never hidden', () => {
  renderStrip({ n: 1, total: 0, repricing: false })
  expect(screen.getByRole('button', { name: 'Sale in progress, 1 product, $ 0. Back' })).toHaveTextContent('$')
})

test('while repricing the amount slot is the loading bar: no symbol, no amount, none in the name', () => {
  renderStrip({ n: 2, total: 11000, repricing: true })
  const strip = screen.getByRole('button', { name: 'Sale in progress, 2 products. Back' })
  expect(strip.textContent).not.toContain('$')
  expect(strip.textContent).not.toContain('11')
  expect(strip.querySelector('[aria-hidden="true"]:not(svg)')).not.toBeNull()
})

test('one product reads in the singular', () => {
  renderStrip({ n: 1, total: 4500, repricing: false })
  expect(screen.getByRole('button', { name: /^Sale in progress, 1 product, / })).toHaveTextContent('1 product')
})
