/**
 * `PriceNew` (`PrecioNuevo`) at the screen seam: the price form on its own route, through
 * the real data router with `fetch` faked. A refusal shows under the field it is about and
 * keeps what was typed; "Close" and a save go back by history, else to the variety's page;
 * leaving with something typed asks first.
 */

import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { catalogQueryOptions } from '../../api/catalog'
import { VARIETY, VARIETY_PRICE_NEW, pathTo } from '../../routes'
import { ME, VARIETY_ROW, api, jsonResponse, renderVarieties, writes, type FetchImpl } from './renderVarieties'
import { LIMITS } from '../../copy/limits'
import { expectIconAndTextRule } from '../../test/iconAndTextRule'

const VARIETY_PATH = pathTo(VARIETY, { id: 1 })
const NEW_PATH = pathTo(VARIETY_PRICE_NEW, { id: 1 })

/** Opens the form the way the seller does: from the variety's page, by "New price". */
async function renderOpened(fetchImpl: FetchImpl) {
  const rendered = renderVarieties([VARIETY_PATH], fetchImpl)
  await userEvent.click(await screen.findByRole('link', { name: 'New price' }))
  return rendered
}

afterEach(() => {
  vi.unstubAllGlobals()
})

const CREATED = jsonResponse(201, {
  id: 4,
  effective_from: '2026-10-02',
  list_price: 12000,
  bulk_price: null,
  bulk_minimum: null,
})

test('the date starts as today and a save posts the amounts, goes back and toasts "Price saved" once', async () => {
  const user = userEvent.setup()
  const { router, fetchMock } = await renderOpened(api({ 'POST /api/products/1/prices': () => CREATED.clone() }),
  )

  expect(await screen.findByRole('button', { name: 'Today 02/10' })).toBeInTheDocument()
  await user.type(screen.getByLabelText(/^List price/), '12000')
  await user.click(screen.getByRole('button', { name: 'Save the price' }))

  expect(await screen.findByText('Variety page')).toBeInTheDocument()
  expect(router.state.location.pathname).toBe(VARIETY_PATH)
  expect(await screen.findAllByText('Price saved')).toHaveLength(1)
  expect(writes(fetchMock)).toEqual([
    { call: 'POST /api/products/1/prices', body: { effective_from: ME.today, list_price: 12000 } },
  ])
})

test('a save sends the bulk tier when one is typed', async () => {
  const user = userEvent.setup()
  const { fetchMock } = await renderOpened(api({ 'POST /api/products/1/prices': () => CREATED.clone() }),
  )

  await user.type(await screen.findByLabelText(/^List price/), '12000')
  await user.type(screen.getByLabelText(/^Bulk price/), '11000')
  await user.type(screen.getByLabelText(/^Minimum in grams/), '10')
  await user.click(screen.getByRole('button', { name: 'Save the price' }))

  await screen.findByText('Price saved')
  expect(writes(fetchMock)[0]?.body).toEqual({
    effective_from: ME.today,
    list_price: 12000,
    bulk_price: 11000,
    bulk_minimum: '10',
  })
})

test('a save marks the catalog stale', async () => {
  const user = userEvent.setup()
  const { queryClient } = await renderOpened(api({ 'POST /api/products/1/prices': () => CREATED.clone() }),
  )
  queryClient.setQueryData(catalogQueryOptions().queryKey, { text: null, header: '', footer: '', products: [] })

  await user.type(await screen.findByLabelText(/^List price/), '12000')
  await user.click(screen.getByRole('button', { name: 'Save the price' }))
  await screen.findByText('Price saved')

  expect(queryClient.getQueryState(catalogQueryOptions().queryKey)?.isInvalidated).toBe(true)
})

test('a repeated date is refused under "Effective from" and keeps what was typed', async () => {
  const user = userEvent.setup()
  const { router } = await renderOpened(api({
      'POST /api/products/1/prices': () => jsonResponse(409, { code: 'variety.duplicate_effective_date' }),
    }),
  )

  await user.type(await screen.findByLabelText(/^List price/), '12000')
  await user.click(screen.getByRole('button', { name: 'Save the price' }))

  const alert = await screen.findByText('You already entered a price with that date')
  expect(alert.closest('.campo')).toHaveTextContent('Effective from')
  expect(alert.closest('.campo')).toContainElement(screen.getByRole('button', { name: 'Today 02/10' }))
  expect(screen.getByLabelText(/^List price/)).toHaveValue('12000')
  expect(router.state.location.pathname).toBe(NEW_PATH)
})

test('an invalid price set is refused under "List price"', async () => {
  const user = userEvent.setup()
  await renderOpened(api({ 'POST /api/products/1/prices': () => jsonResponse(422, { code: 'variety.price_entry_invalid' }) }),
  )

  await user.type(await screen.findByLabelText(/^List price/), '12000')
  await user.click(screen.getByRole('button', { name: 'Save the price' }))

  const alert = await screen.findByText('Check the prices entered')
  expect(alert.closest('label')).toHaveTextContent('List price')
})

test('a grams refusal is shown under "Minimum in grams"', async () => {
  const user = userEvent.setup()
  await renderOpened(api({ 'POST /api/products/1/prices': () => jsonResponse(422, { code: 'grams.invalid' }) }),
  )

  await user.type(await screen.findByLabelText(/^List price/), '12000')
  await user.click(screen.getByRole('button', { name: 'Save the price' }))

  const alert = await screen.findByText('Check the grams entered')
  expect(alert.closest('label')).toHaveTextContent('Minimum in grams')
})

test('an amount that is not a number is refused under its field and nothing is sent', async () => {
  const user = userEvent.setup()
  const { fetchMock } = await renderOpened(api())

  await user.type(await screen.findByLabelText(/^List price/), 'abc')
  await user.click(screen.getByRole('button', { name: 'Save the price' }))

  expect((await screen.findByText('Check the prices entered')).closest('label')).toHaveTextContent(
    'List price',
  )
  expect(writes(fetchMock)).toEqual([])
})

test('an untouched form closes at once, back to the page that opened it', async () => {
  const user = userEvent.setup()
  const { router } = await renderOpened(api())

  await user.click(await screen.findByRole('button', { name: 'Close' }))

  expect(await screen.findByText('Variety page')).toBeInTheDocument()
  expect(router.state.location.pathname).toBe(VARIETY_PATH)
})

test('with no history, "Close" goes to the variety\'s page', async () => {
  const user = userEvent.setup()
  const { router } = renderVarieties([NEW_PATH], api())

  await user.click(await screen.findByRole('button', { name: 'Close' }))

  expect(await screen.findByText('Variety page')).toBeInTheDocument()
  expect(router.state.location.pathname).toBe(VARIETY_PATH)
})

test('closing with something typed asks first; staying keeps it, discarding saves nothing', async () => {
  const user = userEvent.setup()
  const { router, fetchMock } = await renderOpened(api())

  await user.type(await screen.findByLabelText(/^List price/), '12000')
  await user.click(screen.getByRole('button', { name: 'Close' }))
  expect(await screen.findByText('Discard the price?')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'No, keep entering' }))

  expect(screen.queryByText('Discard the price?')).not.toBeInTheDocument()
  expect(screen.getByLabelText(/^List price/)).toHaveValue('12000')
  expect(router.state.location.pathname).toBe(NEW_PATH)

  await user.click(screen.getByRole('button', { name: 'Close' }))
  await user.click(await screen.findByRole('button', { name: 'Yes, discard it' }))

  expect(await screen.findByText('Variety page')).toBeInTheDocument()
  expect(writes(fetchMock)).toEqual([])
})

test('a variety that is gone says "That is gone." and goes back to Variedades', async () => {
  renderVarieties(
    [NEW_PATH],
    api({ 'GET /api/products/1': () => jsonResponse(404, { code: 'variety.not_found' }) }),
  )

  expect(await screen.findByText('That is gone.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Back to Varieties' })).toBeInTheDocument()
})

test('a variety that vanishes while saving shows the gone screen', async () => {
  const user = userEvent.setup()
  await renderOpened(api({ 'POST /api/products/1/prices': () => jsonResponse(404, { code: 'variety.not_found' }) }),
  )

  await user.type(await screen.findByLabelText(/^List price/), '12000')
  await user.click(screen.getByRole('button', { name: 'Save the price' }))

  expect(await screen.findByText('That is gone.')).toBeInTheDocument()
})

test('the form keeps the icon and text rule, its help lines within their limits', async () => {
  await renderOpened(api({}))

  await screen.findByRole('button', { name: 'Today 02/10' })
  expect(document.querySelectorAll('[data-copy="help"]')).toHaveLength(4)
  expectIconAndTextRule(screen.getByRole('main'), { limits: LIMITS })
})

const SETTINGS_URL = 'GET /pricing-settings'

function switches(bulk: boolean, vip: boolean): Record<string, () => Response> {
  return { [SETTINGS_URL]: () => jsonResponse(200, { is_bulk_pricing: bulk, is_vip_customers: vip }) }
}

test('with Clientes VIP on, a typed "VIP price" is sent beside the amounts', async () => {
  const user = userEvent.setup()
  const { fetchMock } = renderVarieties(
    [pathTo(VARIETY, { id: 1 }), NEW_PATH],
    api({ 'POST /api/products/1/prices': () => CREATED.clone() }),
  )

  await user.type(await screen.findByLabelText(/^List price/), '12000')
  await user.type(screen.getByLabelText(/^VIP price/), '9000')
  await user.click(screen.getByRole('button', { name: 'Save the price' }))

  await screen.findByText('Price saved')
  expect(writes(fetchMock)[0]?.body).toEqual({
    effective_from: ME.today,
    list_price: 12000,
    vip_price: 9000,
  })
})

test('with Clientes VIP off the form has no "VIP price" and says nothing about it', async () => {
  const user = userEvent.setup()
  const { fetchMock } = renderVarieties(
    [pathTo(VARIETY, { id: 1 }), NEW_PATH],
    api({ ...switches(true, false), 'POST /api/products/1/prices': () => CREATED.clone() }),
  )

  await user.type(await screen.findByLabelText(/^List price/), '12000')
  expect(screen.queryByLabelText(/VIP price/)).not.toBeInTheDocument()
  expect(screen.queryByText(/VIP/)).not.toBeInTheDocument()
  expect(screen.getByLabelText(/^Bulk price/)).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Save the price' }))

  await screen.findByText('Price saved')
  expect(writes(fetchMock)[0]?.body).toEqual({ effective_from: ME.today, list_price: 12000 })
})

test('with Bulk price off the form has no bulk price or minimum and says nothing about them', async () => {
  const user = userEvent.setup()
  const { fetchMock } = renderVarieties(
    [pathTo(VARIETY, { id: 1 }), NEW_PATH],
    api({ ...switches(false, true), 'POST /api/products/1/prices': () => CREATED.clone() }),
  )

  await user.type(await screen.findByLabelText(/^List price/), '12000')
  expect(screen.queryByLabelText(/Bulk price/)).not.toBeInTheDocument()
  expect(screen.queryByLabelText(/Mínimo en gramos/)).not.toBeInTheDocument()
  expect(screen.queryByText(/cantidad/i)).not.toBeInTheDocument()
  expect(screen.getByLabelText(/^VIP price/)).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Save the price' }))

  await screen.findByText('Price saved')
  expect(writes(fetchMock)[0]?.body).toEqual({ effective_from: ME.today, list_price: 12000 })
})

test('with both rules off only the list price is asked for', async () => {
  renderVarieties([pathTo(VARIETY, { id: 1 }), NEW_PATH], api(switches(false, false)))

  await screen.findByLabelText(/^List price/)

  expect(screen.queryByLabelText(/VIP price/)).not.toBeInTheDocument()
  expect(screen.queryByLabelText(/Bulk price/)).not.toBeInTheDocument()
  expect(screen.queryByLabelText(/Mínimo en gramos/)).not.toBeInTheDocument()
})

test('a VIP price at or above list is refused inline under its field and keeps what was typed', async () => {
  const user = userEvent.setup()
  renderVarieties(
    [pathTo(VARIETY, { id: 1 }), NEW_PATH],
    api({
      'POST /api/products/1/prices': () => jsonResponse(422, { code: 'variety.vip_price_not_below_list' }),
    }),
  )

  await user.type(await screen.findByLabelText(/^List price/), '12000')
  await user.type(screen.getByLabelText(/^VIP price/), '12000')
  await user.click(screen.getByRole('button', { name: 'Save the price' }))

  const message = await screen.findByText('The VIP price has to be lower than the list price')
  expect(message).toBeInTheDocument()
  expect(message.textContent).not.toMatch(/\d/)
  expect(screen.getByLabelText(/^VIP price/)).toHaveValue('12000')
  expect(screen.getByLabelText(/^List price/)).toHaveValue('12000')
})

test('a VIP price that is not a whole amount is refused before sending', async () => {
  const user = userEvent.setup()
  const { fetchMock } = renderVarieties([pathTo(VARIETY, { id: 1 }), NEW_PATH], api())

  await user.type(await screen.findByLabelText(/^List price/), '12000')
  await user.type(screen.getByLabelText(/^VIP price/), 'abc')
  await user.click(screen.getByRole('button', { name: 'Save the price' }))

  expect(await screen.findByText('Check the prices entered')).toBeInTheDocument()
  expect(writes(fetchMock)).toEqual([])
})

test('a "$" goes before the list, bulk and VIP price and never before the minimum, outside the name and the value', async () => {
  const user = userEvent.setup()
  await renderOpened(api({}))

  const amounts = [/^List price/, /^Bulk price/, /^VIP price/]
  for (const label of amounts) {
    const input = await screen.findByLabelText(label)
    const prefix = input.previousElementSibling
    expect(prefix).toHaveTextContent('$')
    expect(prefix).toHaveAttribute('aria-hidden', 'true')
    expect(input.parentElement).toHaveClass('campo__monto')
    await user.type(input, '1500')
    expect(input).toHaveValue('1500')
    expect(screen.getByRole('textbox', { name: label })).toBe(input)
    expect(input).not.toHaveAccessibleName(/\$/)
  }
  const minimum = screen.getByLabelText(/^Minimum in grams/)
  expect(minimum.parentElement).not.toHaveClass('campo__monto')
  expect(minimum.closest('.campo')).not.toHaveTextContent('$')
})

const CHIP_TODAY = { name: 'Today 02/10' }

test('the date is a chip reading "Hoy dd/mm" with "Effective from" as its description, not its name', async () => {
  await renderOpened(api({}))

  const chip = await screen.findByRole('button', CHIP_TODAY)
  expect(chip).toHaveAccessibleDescription('Effective from')
  expect(chip).toHaveAttribute('aria-expanded', 'false')
  expect(screen.queryByRole('button', { name: /Effective from/ })).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Effective from')).not.toBeInTheDocument()
})

test('picking another day reads "dd/mm" on the chip, and "Today" from the chip goes back to today', async () => {
  const user = userEvent.setup()
  await renderOpened(api({}))

  await user.click(await screen.findByRole('button', CHIP_TODAY))
  const input = screen.getByLabelText('Effective from', { exact: true })
  expect(screen.getByLabelText('Effective from')).toBe(input)
  expect(input).toHaveAttribute('type', 'date')
  expect(input).toHaveValue(ME.today)
  fireEvent.change(input, { target: { value: '2026-10-09' } })

  const chip = await screen.findByRole('button', { name: '09/10' })
  expect(chip).toHaveAttribute('aria-expanded', 'false')
  expect(document.querySelector('input[type=date]')).toBeNull()

  await user.click(chip)
  await user.click(screen.getByRole('button', { name: 'Today' }))
  expect(await screen.findByRole('button', CHIP_TODAY)).toBeInTheDocument()
  expect(document.querySelector('input[type=date]')).toBeNull()
})

test('a save at today\'s date never puts a date input in the DOM', async () => {
  const user = userEvent.setup()
  await renderOpened(api({ 'POST /api/products/1/prices': () => CREATED.clone() }))

  await user.type(await screen.findByLabelText(/^List price/), '12000')
  expect(document.querySelector('input[type=date]')).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Save the price' }))

  await screen.findByText('Price saved')
  expect(document.querySelector('input[type=date]')).toBeNull()
})

test('a refused save keeps the chosen date, and a save sends it', async () => {
  const user = userEvent.setup()
  let calls = 0
  const { fetchMock } = await renderOpened(api({
    'POST /api/products/1/prices': () =>
      ++calls === 1 ? jsonResponse(409, { code: 'variety.duplicate_effective_date' }) : CREATED.clone(),
  }))

  await user.click(await screen.findByRole('button', CHIP_TODAY))
  fireEvent.change(screen.getByLabelText('Effective from', { exact: true }), { target: { value: '2026-09-20' } })
  await user.type(await screen.findByLabelText(/^List price/), '12000')
  await user.click(screen.getByRole('button', { name: 'Save the price' }))

  expect(await screen.findByText('You already entered a price with that date')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '20/09' })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Save the price' }))

  await screen.findByText('Price saved')
  expect(writes(fetchMock).map((write) => write.body)).toEqual([
    { effective_from: '2026-09-20', list_price: 12000 },
    { effective_from: '2026-09-20', list_price: 12000 },
  ])
})

test('another day counts as typed: leaving asks first', async () => {
  const user = userEvent.setup()
  await renderOpened(api())

  await user.click(await screen.findByRole('button', CHIP_TODAY))
  fireEvent.change(screen.getByLabelText('Effective from', { exact: true }), { target: { value: '2026-10-09' } })
  await user.click(screen.getByRole('button', { name: 'Close' }))

  expect(await screen.findByText('Discard the price?')).toBeInTheDocument()
})

test('a bulk minimum finer than the unit shows its sentence and sends nothing; a server refusal shows at form level', async () => {
  const user = userEvent.setup()
  const { fetchMock } = await renderOpened(
    api({
      'GET /api/products/1': () =>
        jsonResponse(200, { ...VARIETY_ROW, unit: { id: 1, name: 'grams', label: 'g', decimals: 2 } }),
      'POST /api/products/1/prices': () => jsonResponse(422, { code: 'quantity.too_many_decimals' }),
    }),
  )

  await user.type(await screen.findByLabelText(/^List price/), '12000')
  await user.type(screen.getByLabelText(/^Bulk price/), '11000')
  await user.type(screen.getByLabelText(/^Minimum in grams/), '1.234')
  await user.click(screen.getByRole('button', { name: 'Save the price' }))
  expect(await screen.findByText('Up to 2 decimals')).toBeInTheDocument()
  expect(writes(fetchMock)).toEqual([])
  expect(screen.getByLabelText(/^Minimum in grams/)).toHaveValue('1.234')

  await user.clear(screen.getByLabelText(/^Minimum in grams/))
  await user.type(screen.getByLabelText(/^Minimum in grams/), '1.5')
  await user.click(screen.getByRole('button', { name: 'Save the price' }))
  expect(await screen.findByText('This quantity has too many decimals for its unit.')).toBeInTheDocument()
  expect(screen.getByLabelText(/^Minimum in grams/)).toHaveValue('1.5')
})
