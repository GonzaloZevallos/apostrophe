/**
 * `PriceHistory` (`VerTodas`) at the screen seam: a variety's whole price history,
 * newest first, with "Rige desde", and each row's delete through "Antes de borrar".
 * The API is faked at `fetch`.
 */

import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { catalogQueryOptions } from '../../api/catalog'
import { PRICE_HISTORY_HELP } from './varietiesMessages'
import { LIMITS, SAMPLES } from '../../copy/limits'
import { VARIETY_PRICES, pathTo } from '../../routes'
import { expectIconAndTextRule, iconAndTextProblems } from '../../test/iconAndTextRule'
import { HISTORY, VARIETY_ROW, api, jsonResponse, renderVarieties, writes } from './renderVarieties'

afterEach(() => {
  vi.unstubAllGlobals()
})

test('lists every price newest first with "Rige desde", the one in force and its bulk tier', async () => {
  renderVarieties([pathTo(VARIETY_PRICES, { id: 1 })], api())

  const rows = (await screen.findAllByText(/^Rige desde/)).map((node) => node.textContent)
  expect(screen.queryByText(/^‹/)).toBeNull()
  expect(rows).toEqual(['Rige desde 25/09Vigente hoy', 'Rige desde 01/09', 'Rige desde 05/07'])
  expect(screen.getByText('Vigente hoy')).toBeInTheDocument()
  expect(screen.getByText('Desde 10 g · $ 10.000')).toBeInTheDocument()
  expect(screen.getByText('$ 11.000')).toBeInTheDocument()
  expect(screen.getAllByRole('button', { name: 'Borrar este precio' })).toHaveLength(3)
  expect(screen.getByText('Cada venta usa el precio que regía ese día, aunque lo cambies después.')).toBeInTheDocument()
})

test('deleting says what takes the entry\'s place, then toasts "Precio eliminado"', async () => {
  const user = userEvent.setup()
  const { fetchMock } = renderVarieties(
    [pathTo(VARIETY_PRICES, { id: 1 })],
    api({ 'DELETE /varieties/1/prices/3': () => new Response(null, { status: 204 }) }),
  )

  const buttons = await screen.findAllByRole('button', { name: 'Borrar este precio' })
  await user.click(buttons[0]!)
  const dialog = await screen.findByRole('alertdialog')
  expect(within(dialog).getByText('¿Borrás el precio desde el 25/09?')).toBeInTheDocument()
  expect(within(dialog).getByText('Vuelve a regir $ 10.500 x g desde el 01/09')).toBeInTheDocument()
  await user.click(within(dialog).getByRole('button', { name: 'Sí, borrala' }))

  expect(await screen.findByText('Precio eliminado')).toBeInTheDocument()
  expect(writes(fetchMock)).toEqual([{ call: 'DELETE /varieties/1/prices/3', body: undefined }])
})

test('a delete marks the catalog stale', async () => {
  const user = userEvent.setup()
  const { queryClient } = renderVarieties(
    [pathTo(VARIETY_PRICES, { id: 1 })],
    api({ 'DELETE /varieties/1/prices/3': () => new Response(null, { status: 204 }) }),
  )
  queryClient.setQueryData(catalogQueryOptions().queryKey, { text: null, header: '', footer: '', varieties: [] })

  const buttons = await screen.findAllByRole('button', { name: 'Borrar este precio' })
  await user.click(buttons[0]!)
  await user.click(await screen.findByRole('button', { name: 'Sí, borrala' }))
  await screen.findByText('Precio eliminado')

  expect(queryClient.getQueryState(catalogQueryOptions().queryKey)?.isInvalidated).toBe(true)
})

test('a variety that is gone says "Eso ya no está." and goes back to Variedades', async () => {
  renderVarieties(
    [pathTo(VARIETY_PRICES, { id: 1 })],
    api({
      'GET /varieties/1': () => jsonResponse(404, { code: 'variety.not_found' }),
      'GET /varieties/1/prices': () => jsonResponse(404, { code: 'variety.not_found' }),
    }),
  )

  expect(await screen.findByText('Eso ya no está.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Volver a Variedades' })).toBeInTheDocument()
})

test('an id that is not a number is gone too, and asks the API nothing', async () => {
  const { fetchMock } = renderVarieties([pathTo(VARIETY_PRICES, { id: 'abc' })], api())

  expect(await screen.findByText('Eso ya no está.')).toBeInTheDocument()
  expect(fetchMock).not.toHaveBeenCalled()
})

test('a delete that finds the price gone says so and refreshes the list', async () => {
  const user = userEvent.setup()
  renderVarieties(
    [pathTo(VARIETY_PRICES, { id: 1 })],
    api({ 'DELETE /varieties/1/prices/3': () => jsonResponse(404, { code: 'variety.price_entry_not_found' }) }),
  )

  const buttons = await screen.findAllByRole('button', { name: 'Borrar este precio' })
  await user.click(buttons[0]!)
  await user.click(await screen.findByRole('button', { name: 'Sí, borrala' }))

  expect(await screen.findByText('Eso ya no está. La lista ya está al día.')).toBeInTheDocument()
})

function switches(bulk: boolean, vip: boolean): Record<string, () => Response> {
  return { 'GET /pricing-settings': () => jsonResponse(200, { is_bulk_pricing: bulk, is_vip_customers: vip }) }
}

test('with both rules on, an entry shows its bulk tier and its "Precio VIP"', async () => {
  renderVarieties([pathTo(VARIETY_PRICES, { id: 1 })], api())

  expect(await screen.findByText('Precio VIP · $ 9.000')).toBeInTheDocument()
  expect(screen.getByText('Desde 10 g · $ 10.000')).toBeInTheDocument()
  expect(screen.getAllByText(/Precio VIP/)).toHaveLength(1)
})

test('with Clientes VIP off there is no trace of the VIP price, the bulk tier stays', async () => {
  renderVarieties([pathTo(VARIETY_PRICES, { id: 1 })], api(switches(true, false)))

  expect(await screen.findByText('Desde 10 g · $ 10.000')).toBeInTheDocument()
  expect(screen.queryByText(/VIP/)).not.toBeInTheDocument()
  expect(screen.queryByText(/9\.000/)).not.toBeInTheDocument()
})

test('with Precio por cantidad off there is no trace of the bulk tier, the VIP price stays', async () => {
  renderVarieties([pathTo(VARIETY_PRICES, { id: 1 })], api(switches(false, true)))

  expect(await screen.findByText('Precio VIP · $ 9.000')).toBeInTheDocument()
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

  await screen.findByText('Desde 10 g · $ 10.000')
  expect(screen.queryByText(/VIP/)).not.toBeInTheDocument()
})

test("an archived variety's price history is read-only: rows with no delete", async () => {
  renderVarieties(
    [pathTo(VARIETY_PRICES, { id: 1 })],
    api({ 'GET /varieties/1': () => jsonResponse(200, { ...VARIETY_ROW, archived: true }) }),
  )

  expect(await screen.findAllByText(/^Rige desde/)).toHaveLength(3)
  expect(screen.queryByRole('button', { name: 'Borrar este precio' })).toBeNull()
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

  expect(await screen.findByText('Desde 10 g · $ 10.000')).toBeInTheDocument()
  expect(screen.getAllByText(/^Rige desde/)).toHaveLength(3)
  expect(screen.queryByText(/VIP/)).not.toBeInTheDocument()
})
