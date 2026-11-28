/**
 * The structure of a Product's page, as a contract the later parts of the redesign keep
 * unedited (varieties.md, "Rediseño de la página según ProductoDetalle"): which `h2`s the main
 * content has and in which order, and which buttons and links sit outside the sections.
 * Read through the real shell and `renderVarieties.tsx`, with `fetch` faked.
 *
 * The state block contributes no control: it is a list of text, so the names below are the
 * actions of the page frame alone.
 */

import { screen, within } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { VARIETY, pathTo } from '../../routes'
import { api, jsonResponse, renderVarietiesInShell } from './renderVarieties'

const PAGE = pathTo(VARIETY, { id: 1 })

const STOCK = {
  total: 18,
  entries: [],
  products: [{ product_id: 1, quantity: 18, status: 'low', sold_out_since: null, threshold: 20, days_left: 24 }],
}
const CATALOG = {
  text: 'texto',
  header: '',
  footer: '',
  products: [{ product_id: 1, name: '24K Gold', emoji: null, indica_share: null, aroma: null, shown: true, state: 'in' }],
}
const ARCHIVED_ATTRIBUTES = [{ product_id: 1, name: '24K Gold', shown: true, emoji: null, indica_share: null, aroma: null }]

const LIVE = {
  'GET /stock': () => jsonResponse(200, STOCK),
  'GET /catalog': () => jsonResponse(200, CATALOG),
  'GET /stock/products/1/movements': () => jsonResponse(200, []),
}
const ARCHIVED = {
  'GET /api/products/1': () => jsonResponse(200, { id: 1, name: '24K Gold', current_price: null, archived: true, removal: null }),
  'GET /stock?archived=true': () => jsonResponse(200, STOCK),
  'GET /catalog/archived': () => jsonResponse(200, ARCHIVED_ATTRIBUTES),
  'GET /stock/products/1/movements': () => jsonResponse(200, []),
}

afterEach(() => {
  vi.unstubAllGlobals()
})

/** The name a control is read by: its `aria-label` when it has one, else its text. */
function nameOf(control: HTMLElement): string {
  return control.getAttribute('aria-label') ?? control.textContent
}

/** The buttons and links of the main content that are not inside a `section`, in page order. */
function frameControls(main: HTMLElement): string[] {
  return [...within(main).queryAllByRole('button'), ...within(main).queryAllByRole('link')]
    .filter((control) => control.closest('section') === null)
    .sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))
    .map(nameOf)
}

describe('the structure of the Product page', () => {
  test.each([['active', LIVE], ['archived', ARCHIVED]])(
    'a %s Product has the four h2s in order',
    async (_kind, answers) => {
      renderVarietiesInShell([PAGE], api(answers))

      await screen.findByRole('heading', { level: 2, name: 'Prices' })
      const main = screen.getByRole('main')
      expect(within(main).getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)).toEqual([
        'Prices',
        'In the catalog',
        'Stock and entries',
        'Low stock warning',
      ])
    },
  )

  test.each([['delete'], ['archive']])(
    'an active Product, with removal %s, has the edit-name, the three actions and the one removal outside the sections',
    async (removal) => {
      const removalName = removal === 'delete' ? 'Delete product' : 'Archive product'
      renderVarietiesInShell(
        [PAGE],
        api({ ...LIVE, 'GET /api/products/1': () => jsonResponse(200, { id: 1, name: '24K Gold', current_price: null, removal }) }),
      )

      await screen.findByRole('button', { name: removalName })
      expect(frameControls(screen.getByRole('main'))).toEqual(['Edit name', '+ Entry', 'New price', 'Take from stock', removalName])
    },
  )

  test('an archived Product has Restore alone outside the sections', async () => {
    renderVarietiesInShell([PAGE], api(ARCHIVED))

    await screen.findByRole('button', { name: 'Restore' })
    expect(frameControls(screen.getByRole('main'))).toEqual(['Restore'])
  })

  test('the h1 comes first, then the state block, then the actions, the sections, and the removal last', async () => {
    renderVarietiesInShell(
      [PAGE],
      api({ ...LIVE, 'GET /api/products/1': () => jsonResponse(200, { id: 1, name: '24K Gold', current_price: null, removal: 'archive' }) }),
    )

    const archive = await screen.findByRole('button', { name: 'Archive product' })
    const main = screen.getByRole('main')
    const list = within(main).getByRole('list', { name: '24K Gold' })
    const title = within(main).getByRole('heading', { level: 1 })
    const entry = within(main).getByRole('link', { name: '+ Entry' })
    const prices = within(main).getByRole('heading', { level: 2, name: 'Prices' })
    const follows = (earlier: Element, later: Element): boolean =>
      (earlier.compareDocumentPosition(later) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
    expect(follows(title, list)).toBe(true)
    expect(follows(list, entry)).toBe(true)
    expect(follows(entry, prices)).toBe(true)
    expect(follows(prices, archive)).toBe(true)
  })
})
