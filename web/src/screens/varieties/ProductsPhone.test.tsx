/**
 * The phone Products title block: its one "New product" action, found by role and accessible
 * name, opens the new-product form. How it looks (neutral, never green) is measured in a real
 * browser by `e2e/productsHeader.spec.ts`: jsdom draws no colour.
 */

import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, test } from 'vitest'
import { MoneyFormatProvider } from '../../format/MoneyFormatProvider'
import { VARIETY_NEW } from '../../routes'
import type { ProductsView } from './ProductsBody'
import ProductsPhone from './ProductsPhone'

const VIEW: ProductsView = {
  rows: [],
  hidden: new Set<number>(),
  summary: null,
  failure: null,
  ready: true,
  catalogDisabled: false,
  archivedCount: 0,
  feedback: null,
  goneExited: false,
  today: '2026-10-02',
  computer: false,
}

describe('ProductsPhone title block', () => {
  test('has one link named "New product" that opens the new-product form, beside the title', () => {
    render(
      <MemoryRouter>
        <MoneyFormatProvider format={{ symbol: '$', decimals: 0 }}>
          <ProductsPhone view={VIEW} />
        </MoneyFormatProvider>
      </MemoryRouter>,
    )

    const links = screen.getAllByRole('link', { name: 'New product' })
    expect(links).toHaveLength(1)
    expect(links[0]).toHaveAttribute('href', VARIETY_NEW)
    expect(screen.getByRole('heading', { level: 1, name: 'Products' })).toBeInTheDocument()
  })
})
