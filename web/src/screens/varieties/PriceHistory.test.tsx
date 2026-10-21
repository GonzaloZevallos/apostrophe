/**
 * `PriceHistory` (`VerTodas`) at the screen seam: a variety's whole price history,
 * newest first, with "Effective from", and each row's delete through "Before deleting".
 * The API is faked at `fetch`.
 */

import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { catalogQueryOptions } from '../../api/catalog'
import { PRICE_HISTORY_HELP } from '../../copy/varieties'
import { LIMITS, SAMPLES } from '../../copy/limits'
import { VARIETY, VARIETY_PRICES, pathTo } from '../../routes'
import { expectIconAndTextRule, iconAndTextProblems } from '../../test/iconAndTextRule'
import { HISTORY, VARIETY_ROW, api, jsonResponse, renderVarieties, writes } from './renderVarieties'

afterEach(() => {
  vi.unstubAllGlobals()
})

test('lists every price newest first with "Effective from", the one in force and its bulk tier', async () => {
  renderVarieties([pathTo(VARIETY_PRICES, { id: 1 })], api())

  expect(await screen.findByRole('button', { name: '‹ 24K Gold' })).toBeInTheDocument()
  const rows = (await screen.findAllByText(/^Effective from/)).map((node) => node.textContent)
  expect(rows).toEqual(['Effective from 25/09In force today', 'Effective from 01/09', 'Effective from 05/07'])
  expect(screen.getByText('In force today')).toBeInTheDocument()
  expect(screen.getByText('From 10 g · $ 10.000')).toBeInTheDocument()
  expect(screen.getByText('$ 11.000')).toBeInTheDocument()
  expect(screen.getAllByRole('button', { name: 'Delete this price' })).toHaveLength(3)
  expect(screen.getByText('Each sale uses the price in force that day, even if you change it later.')).toBeInTheDocument()
})

test('back goes by history to where the seller came from', async () => {
  const user = userEvent.setup()
  const { router } = renderVarieties([pathTo(VARIETY, { id: 1 })], api())
  await user.click(await screen.findByRole('link', { name: 'See all prices' }))

  await user.click(await screen.findByRole('button', { name: '‹ 24K Gold' }))

  expect(await screen.findByText('Variety page')).toBeInTheDocument()
  expect(router.state.location.pathname).toBe(pathTo(VARIETY, { id: 1 }))
  expect(router.state.historyAction).toBe('POP')
})

test('while the variety loads there is no back, not even a placeholder; once it loads the back names it', async () => {
  let release: (response: Response) => void = () => undefined
  const pending = new Promise<Response>((resolve) => {
    release = resolve
  })
  const served = api()
  renderVarieties([pathTo(VARIETY_PRICES, { id: 1 })], (url, init) =>
    url === '/varieties/1' ? pending : served(url, init),
  )

  await waitFor(() => expect(screen.getAllByRole('navigation').length).toBeGreaterThan(0))
  expect(screen.queryByText(/‹/)).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /^‹/ })).not.toBeInTheDocument()

  release(jsonResponse(200, VARIETY_ROW))

  expect(await screen.findByRole('button', { name: '‹ 24K Gold' })).toBeInTheDocument()
})

test('a variety that is gone shows no back, only its own way out', async () => {
  const gone = () => jsonResponse(404, { code: 'variety.not_found', detail: 'No existe' })
  renderVarieties(
    [pathTo(VARIETY_PRICES, { id: 1 })],
    api({ 'GET /varieties/1': gone, 'GET /varieties/1/prices': gone }),
  )

  expect(await screen.findByRole('link', { name: 'Back to Varieties' })).toBeInTheDocument()
  expect(screen.queryByText(/‹/)).not.toBeInTheDocument()
})

test('back with no history goes to the variety\'s page', async () => {
  const user = userEvent.setup()
  const { router } = renderVarieties([pathTo(VARIETY_PRICES, { id: 1 })], api())

  await user.click(await screen.findByRole('button', { name: '‹ 24K Gold' }))

  expect(await screen.findByText('Variety page')).toBeInTheDocument()
  expect(router.state.location.pathname).toBe(pathTo(VARIETY, { id: 1 }))
})

test('deleting says what takes the entry\'s place, then toasts "Price deleted"', async () => {
  const user = userEvent.setup()
  const { fetchMock } = renderVarieties(
    [pathTo(VARIETY_PRICES, { id: 1 })],
    api({ 'DELETE /varieties/1/prices/3': () => new Response(null, { status: 204 }) }),
  )

  const buttons = await screen.findAllByRole('button', { name: 'Delete this price' })
  await user.click(buttons[0]!)
  const dialog = await screen.findByRole('alertdialog')
  expect(within(dialog).getByText('Delete the price from 25/09?')).toBeInTheDocument()
  expect(within(dialog).getByText('Back to $ 10.500 x g from 01/09')).toBeInTheDocument()
  await user.click(within(dialog).getByRole('button', { name: 'Yes, delete it' }))

  expect(await screen.findByText('Price deleted')).toBeInTheDocument()
  expect(writes(fetchMock)).toEqual([{ call: 'DELETE /varieties/1/prices/3', body: undefined }])
})

test('a delete marks the catalog stale', async () => {
  const user = userEvent.setup()
  const { queryClient } = renderVarieties(
    [pathTo(VARIETY_PRICES, { id: 1 })],
    api({ 'DELETE /varieties/1/prices/3': () => new Response(null, { status: 204 }) }),
  )
  queryClient.setQueryData(catalogQueryOptions().queryKey, { text: null, header: '', footer: '', varieties: [] })

  const buttons = await screen.findAllByRole('button', { name: 'Delete this price' })
  await user.click(buttons[0]!)
  await user.click(await screen.findByRole('button', { name: 'Yes, delete it' }))
  await screen.findByText('Price deleted')

  expect(queryClient.getQueryState(catalogQueryOptions().queryKey)?.isInvalidated).toBe(true)
})

test('a variety that is gone says "That is gone." and goes back to Variedades', async () => {
  renderVarieties(
    [pathTo(VARIETY_PRICES, { id: 1 })],
    api({
      'GET /varieties/1': () => jsonResponse(404, { code: 'variety.not_found' }),
      'GET /varieties/1/prices': () => jsonResponse(404, { code: 'variety.not_found' }),
    }),
  )

  expect(await screen.findByText('That is gone.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Back to Varieties' })).toBeInTheDocument()
})

test('an id that is not a number is gone too, and asks the API nothing', async () => {
  const { fetchMock } = renderVarieties([pathTo(VARIETY_PRICES, { id: 'abc' })], api())

  expect(await screen.findByText('That is gone.')).toBeInTheDocument()
  expect(fetchMock).not.toHaveBeenCalled()
})

test('a delete that finds the price gone says so and refreshes the list', async () => {
  const user = userEvent.setup()
  renderVarieties(
    [pathTo(VARIETY_PRICES, { id: 1 })],
    api({ 'DELETE /varieties/1/prices/3': () => jsonResponse(404, { code: 'variety.price_entry_not_found' }) }),
  )

  const buttons = await screen.findAllByRole('button', { name: 'Delete this price' })
  await user.click(buttons[0]!)
  await user.click(await screen.findByRole('button', { name: 'Yes, delete it' }))

  expect(await screen.findByText('That is gone. The list is up to date.')).toBeInTheDocument()
})

function switches(bulk: boolean, vip: boolean): Record<string, () => Response> {
  return { 'GET /pricing-settings': () => jsonResponse(200, { is_bulk_pricing: bulk, is_vip_customers: vip }) }
}

test('with both rules on, an entry shows its bulk tier and its "VIP price"', async () => {
  renderVarieties([pathTo(VARIETY_PRICES, { id: 1 })], api())

  expect(await screen.findByText('VIP price · $ 9.000')).toBeInTheDocument()
  expect(screen.getByText('From 10 g · $ 10.000')).toBeInTheDocument()
  expect(screen.getAllByText(/VIP price/)).toHaveLength(1)
})

test('with Clientes VIP off there is no trace of the VIP price, the bulk tier stays', async () => {
  renderVarieties([pathTo(VARIETY_PRICES, { id: 1 })], api(switches(true, false)))

  expect(await screen.findByText('From 10 g · $ 10.000')).toBeInTheDocument()
  expect(screen.queryByText(/VIP/)).not.toBeInTheDocument()
  expect(screen.queryByText(/9\.000/)).not.toBeInTheDocument()
})

test('with Bulk price off there is no trace of the bulk tier, the VIP price stays', async () => {
  renderVarieties([pathTo(VARIETY_PRICES, { id: 1 })], api(switches(false, true)))

  expect(await screen.findByText('VIP price · $ 9.000')).toBeInTheDocument()
  expect(screen.queryByText(/Desde/)).not.toBeInTheDocument()
  expect(screen.queryByText(/10\.000/)).not.toBeInTheDocument()
})

test('with both rules off only list prices show, and an entry without a VIP price shows no VIP line', async () => {
  renderVarieties([pathTo(VARIETY_PRICES, { id: 1 })], api(switches(false, false)))

  expect(await screen.findByText('$ 11.000')).toBeInTheDocument()
  expect(screen.queryByText(/VIP|Desde/)).not.toBeInTheDocument()
})

test('an entry with no VIP price shows no VIP line even with Clientes VIP on', async () => {
  const bare = HISTORY.map((entry) => ({ ...entry, vip_price: null }))
  renderVarieties([pathTo(VARIETY_PRICES, { id: 1 })], api({ 'GET /varieties/1/prices': () => jsonResponse(200, bare) }))

  await screen.findByText('From 10 g · $ 10.000')
  expect(screen.queryByText(/VIP/)).not.toBeInTheDocument()
})

test("an archived variety's price history is read-only: rows with no delete", async () => {
  renderVarieties(
    [pathTo(VARIETY_PRICES, { id: 1 })],
    api({ 'GET /varieties/1': () => jsonResponse(200, { ...VARIETY_ROW, archived: true }) }),
  )

  expect(await screen.findAllByText(/^Effective from/)).toHaveLength(3)
  expect(screen.queryByRole('button', { name: 'Delete this price' })).toBeNull()
})

test('the history follows the rule: its help line is measured copy and each delete is icon-only', async () => {
  renderVarieties([pathTo(VARIETY_PRICES, { id: 1 })], api())
  const help = await screen.findByText(PRICE_HISTORY_HELP)
  const main = screen.getByRole('main')

  expect(help).toHaveAttribute('data-copy', 'help')
  expectIconAndTextRule(main, { limits: LIMITS, samples: SAMPLES })
  help.textContent = 'x'.repeat(LIMITS.help + 1)
  expect(iconAndTextProblems(main, { limits: LIMITS, samples: SAMPLES })).toHaveLength(1)
})

test("an archived variety's price history follows the switches like a live one", async () => {
  const archived = { 'GET /varieties/1': () => jsonResponse(200, { ...VARIETY_ROW, archived: true }) }
  renderVarieties([pathTo(VARIETY_PRICES, { id: 1 })], api({ ...archived, ...switches(true, false) }))

  expect(await screen.findByText('From 10 g · $ 10.000')).toBeInTheDocument()
  expect(screen.getAllByText(/^Effective from/)).toHaveLength(3)
  expect(screen.queryByText(/VIP/)).not.toBeInTheDocument()
})
