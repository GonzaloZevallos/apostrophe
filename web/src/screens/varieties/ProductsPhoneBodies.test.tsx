/**
 * The phone Products leaves, rendered from a `ProductsView`: what each segment's body draws and
 * never draws, the held data (no empty wording, no digit), a failure shown once, and the held
 * Send catalog block.
 */

import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, test } from 'vitest'
import { MoneyFormatProvider } from '../../format/MoneyFormatProvider'
import { CATALOG_DISABLED_REASON, EMPTY_TITLE, VARIETIES_TEXT } from '../../copy/varieties'
import type { ProductsView } from './ProductsBody'
import { CatalogBody, ProductsNotices, StockBody } from './ProductsPhoneBodies'
import { showsData } from './showsData'

const ROW = {
  variety: { id: 1, name: '24K Gold', archived: false, current_price: null },
  row: { status: 'ok' as const, sold_out_since: null, threshold: null, days_left: 30, quantity: 135 },
}

function viewOf(overrides: Partial<ProductsView> = {}): ProductsView {
  return {
    rows: [ROW],
    hidden: new Set<number>(),
    summary: '1 product in stock',
    failure: null,
    ready: true,
    catalogDisabled: false,
    archivedCount: 3,
    feedback: null,
    goneExited: false,
    today: '2026-10-02',
    computer: false,
    ...overrides,
  }
}

function renderLeaf(ui: React.ReactNode) {
  return render(
    <MemoryRouter>
      <MoneyFormatProvider format={{ symbol: '$', decimals: 0 }}>{ui}</MoneyFormatProvider>
    </MemoryRouter>,
  )
}

const HELD: Partial<ProductsView> = { ready: false, rows: [], summary: null }
/** The reserved summary line: a paragraph holding only a non-breaking space. */
const isBlankLine = (_: string, element: Element | null) => element?.tagName === 'P' && element.textContent === '\u00a0'
const sendCatalog = () => screen.queryByText(VARIETIES_TEXT.mandarCatalogo)
const stockEntry = () => screen.queryByRole('link', { name: VARIETIES_TEXT.entradaDeStock })

describe('showsData', () => {
  test('is true only when the data is in and nothing failed', () => {
    expect(showsData(viewOf())).toBe(true)
    expect(showsData(viewOf({ ready: false }))).toBe(false)
    expect(showsData(viewOf({ failure: 'other' }))).toBe(false)
  })
})

describe('CatalogBody', () => {
  test('draws Send catalog and the rows, and never a stock block', () => {
    renderLeaf(<CatalogBody view={viewOf()} />)
    expect(screen.getByRole('link', { name: VARIETIES_TEXT.mandarCatalogo })).toBeTruthy()
    expect(screen.getByText('24K Gold')).toBeTruthy()
    expect(screen.queryByText('1 product in stock')).toBeNull()
    expect(stockEntry()).toBeNull()
    expect(screen.queryByRole('link', { name: /take from stock/i })).toBeNull()
    expect(screen.queryByText(/all entries/i)).toBeNull()
    expect(screen.queryByText(/^Archived \(/)).toBeNull()
  })

  test('with no rows it draws the empty state, once ready', () => {
    renderLeaf(<CatalogBody view={viewOf({ rows: [] })} />)
    expect(screen.getByText(EMPTY_TITLE)).toBeTruthy()
  })

  test('disabled Send catalog shows its reason', () => {
    renderLeaf(<CatalogBody view={viewOf({ catalogDisabled: true })} />)
    expect(screen.getByRole('button', { name: VARIETIES_TEXT.mandarCatalogo }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByText(CATALOG_DISABLED_REASON)).toBeTruthy()
  })

  test('held data draws no empty wording and no digit', () => {
    const { container } = renderLeaf(<CatalogBody view={viewOf(HELD)} />)
    expect(screen.queryByText(EMPTY_TITLE)).toBeNull()
    expect(container.textContent).not.toMatch(/\d/)
    expect(screen.queryByText('24K Gold')).toBeNull()
  })

  test('catalogHeld draws a reserved busy block with no text, then Send catalog once released', () => {
    const { container, rerender } = renderLeaf(<CatalogBody view={viewOf({ catalogDisabled: true })} catalogHeld />)
    expect(sendCatalog()).toBeNull()
    expect(screen.queryByText(CATALOG_DISABLED_REASON)).toBeNull()
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull()
    rerender(
      <MemoryRouter>
        <MoneyFormatProvider format={{ symbol: '$', decimals: 0 }}>
          <CatalogBody view={viewOf()} catalogHeld={false} />
        </MoneyFormatProvider>
      </MemoryRouter>,
    )
    expect(screen.getByRole('link', { name: VARIETIES_TEXT.mandarCatalogo })).toBeTruthy()
    expect(container.querySelector('[aria-busy="true"]')).toBeNull()
  })
})

describe('StockBody', () => {
  test('draws the summary, both actions, the rows, All entries and Archived (N), and never Send catalog', () => {
    renderLeaf(<StockBody view={viewOf()} />)
    expect(screen.getByText('1 product in stock')).toBeTruthy()
    expect(stockEntry()).toBeTruthy()
    expect(screen.getByRole('link', { name: /take from stock/i })).toBeTruthy()
    expect(screen.getByText('24K Gold')).toBeTruthy()
    expect(screen.getByText(/all entries/i)).toBeTruthy()
    expect(screen.getByText('Archived (3)')).toBeTruthy()
    expect(sendCatalog()).toBeNull()
  })

  test('held data keeps the actions, a blank reserved line, and no empty wording or digit', () => {
    const { container } = renderLeaf(<StockBody view={viewOf({ ...HELD, archivedCount: 3 })} />)
    expect(stockEntry()).toBeTruthy()
    expect(screen.getByText(isBlankLine)).toBeTruthy()
    expect(screen.queryByText(EMPTY_TITLE)).toBeNull()
    expect(container.textContent).not.toMatch(/\d/)
  })

  test('with no rows it draws the empty state beside the actions', () => {
    renderLeaf(<StockBody view={viewOf({ rows: [], summary: null })} />)
    expect(screen.getByText(EMPTY_TITLE)).toBeTruthy()
    expect(stockEntry()).toBeTruthy()
  })

  test('a failure draws no summary line, no rows and no empty state, and keeps the actions', () => {
    renderLeaf(<StockBody view={viewOf({ failure: 'other', ready: false, rows: [] })} />)
    expect(screen.queryByText(isBlankLine)).toBeNull()
    expect(screen.queryByText(EMPTY_TITLE)).toBeNull()
    expect(stockEntry()).toBeTruthy()
  })
})

describe('ProductsNotices', () => {
  test('a failure shows once, with no Loading', () => {
    renderLeaf(<ProductsNotices view={viewOf({ failure: 'other', ready: false, rows: [] })} />)
    expect(screen.getAllByRole('alert')).toHaveLength(1)
    expect(screen.queryByRole('progressbar')).toBeNull()
  })

  test('Loading shows once while the data is held', () => {
    renderLeaf(<ProductsNotices view={viewOf(HELD)} />)
    expect(screen.getAllByRole('progressbar')).toHaveLength(1)
  })

  test('the notice shows instead of the gone notice, once', () => {
    renderLeaf(
      <ProductsNotices view={viewOf({ feedback: { kind: 'toast', message: 'common:entrySaved' }, goneExited: true })} />,
    )
    expect(screen.getAllByRole('status')).toHaveLength(1)
  })

  test('a ready view with nothing to say draws nothing', () => {
    const { container } = renderLeaf(<ProductsNotices view={viewOf()} />)
    expect(container.textContent).toBe('')
  })
})
