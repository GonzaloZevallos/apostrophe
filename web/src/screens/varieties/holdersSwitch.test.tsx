/**
 * A language switch re-renders the words three module-level holders keep, in place: the chip
 * date (`chipDate` takes the caller's `t`), `originLabel` (holds keys) and `priceDeleteNotice`
 * (takes the caller's `t`). Each test renders, keeps the node by ref, installs a fixture `de`
 * bundle and switches; the marker is then in that same node, the English is gone and no key
 * the screen rendered went missing.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import type { Movement, StockView } from '../../api/stock'
import { missingKeys } from '../../i18n/missingKeys'
import { restoreEnglish, switchToMarkers } from '../../i18n/switchFixture'
import { VARIETY_PRICES, VARIETY_PRICE_NEW, pathTo } from '../../routes'
import VarietyStockSection from './VarietyStockSection'
import { api, renderVarieties } from './renderVarieties'

afterEach(async () => {
  await restoreEnglish()
  vi.unstubAllGlobals()
})

function missesFor(keys: readonly string[]) {
  return missingKeys().filter((miss) => keys.includes(`${miss.ns}:${miss.key}`))
}

test('the chip date follows a switch in the same node', async () => {
  renderVarieties([pathTo(VARIETY_PRICE_NEW, { id: 1 })], api())
  const chip = await screen.findByRole('button', { name: 'Today 02/10' })

  await switchToMarkers()

  expect(screen.getByRole('button', { name: /de:common\.todayWith/ })).toBe(chip)
  expect(chip.textContent).toContain('de:common.todayWith')
  expect(chip.textContent).not.toContain('Today')
  expect(missesFor(['common:todayWith'])).toEqual([])
})

const NO_STOCK: StockView = { total: 0, products: [], entries: [] }
const MOVEMENTS: Movement[] = [
  {
    kind: 'entry',
    id: 7,
    date: '2026-10-02',
    product_id: 1,
    origin: 'purchase',
    quantity: 50,
    total_cost: null,
    cost_per_gram: null,
    note: null,
  },
]

test('originLabel follows a switch in the same node', async () => {
  const queryClient = new QueryClient()
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <VarietyStockSection stock={NO_STOCK} movements={MOVEMENTS} varietyId={1} today="2026-10-02" />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  const line = screen.getByText(/Purchase/)

  await switchToMarkers()

  expect(screen.getByText(/de:common\.purchase/)).toBe(line)
  expect(line.textContent).not.toContain('Purchase')
  expect(missesFor(['common:purchase'])).toEqual([])
})

test('priceDeleteNotice follows a switch in the same node', async () => {
  const user = userEvent.setup()
  renderVarieties([pathTo(VARIETY_PRICES, { id: 1 })], api())
  await user.click((await screen.findAllByRole('button', { name: 'Delete this price' }))[0]!)
  const dialog = await screen.findByRole('alertdialog')
  const notice = within(dialog).getByText('Back to $ 10.500 x g from 01/09')

  await switchToMarkers()

  expect(within(dialog).getByText(/de:common\.returnsTo/)).toBe(notice)
  expect(notice.textContent).not.toContain('Back to')
  expect(missesFor(['common:returnsTo'])).toEqual([])
})
