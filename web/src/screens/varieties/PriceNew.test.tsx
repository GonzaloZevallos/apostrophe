/**
 * `PriceNew` (`PrecioNuevo`) at the screen seam: the price form on its own route, through
 * the real data router with `fetch` faked. A refusal shows under the field it is about and
 * keeps what was typed; "Cerrar" and a save go back by history, else to the variety's page;
 * leaving with something typed asks first.
 */

import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { catalogQueryOptions } from '../../api/catalog'
import { VARIETY, VARIETY_PRICE_NEW, pathTo } from '../../routes'
import { ME, api, jsonResponse, renderVarieties, writes, type FetchImpl } from './renderVarieties'
import { LIMITS } from '../../copy/limits'
import { expectIconAndTextRule } from '../../test/iconAndTextRule'

const VARIETY_PATH = pathTo(VARIETY, { id: 1 })
const NEW_PATH = pathTo(VARIETY_PRICE_NEW, { id: 1 })

/** Opens the form the way the seller does: from the variety's page, by "Nuevo precio". */
async function renderOpened(fetchImpl: FetchImpl) {
  const rendered = renderVarieties([VARIETY_PATH], fetchImpl)
  await userEvent.click(await screen.findByRole('link', { name: 'Nuevo precio' }))
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

test('the date starts as today and a save posts the amounts, goes back and toasts "Precio guardado" once', async () => {
  const user = userEvent.setup()
  const { router, fetchMock } = await renderOpened(api({ 'POST /varieties/1/prices': () => CREATED.clone() }),
  )

  expect(await screen.findByRole('button', { name: 'Hoy 02/10' })).toBeInTheDocument()
  await user.type(screen.getByLabelText(/^Precio de lista/), '12000')
  await user.click(screen.getByRole('button', { name: 'Guardá el precio' }))

  expect(await screen.findByText('Página de la variedad')).toBeInTheDocument()
  expect(router.state.location.pathname).toBe(VARIETY_PATH)
  expect(await screen.findAllByText('Precio guardado')).toHaveLength(1)
  expect(writes(fetchMock)).toEqual([
    { call: 'POST /varieties/1/prices', body: { effective_from: ME.today, list_price: 12000 } },
  ])
})

test('a save sends the bulk tier when one is typed', async () => {
  const user = userEvent.setup()
  const { fetchMock } = await renderOpened(api({ 'POST /varieties/1/prices': () => CREATED.clone() }),
  )

  await user.type(await screen.findByLabelText(/^Precio de lista/), '12000')
  await user.type(screen.getByLabelText(/^Precio por cantidad/), '11000')
  await user.type(screen.getByLabelText(/^Mínimo en gramos/), '10')
  await user.click(screen.getByRole('button', { name: 'Guardá el precio' }))

  await screen.findByText('Precio guardado')
  expect(writes(fetchMock)[0]?.body).toEqual({
    effective_from: ME.today,
    list_price: 12000,
    bulk_price: 11000,
    bulk_minimum: '10',
  })
})

test('a save marks the catalog stale', async () => {
  const user = userEvent.setup()
  const { queryClient } = await renderOpened(api({ 'POST /varieties/1/prices': () => CREATED.clone() }),
  )
  queryClient.setQueryData(catalogQueryOptions().queryKey, { text: null, header: '', footer: '', varieties: [] })

  await user.type(await screen.findByLabelText(/^Precio de lista/), '12000')
  await user.click(screen.getByRole('button', { name: 'Guardá el precio' }))
  await screen.findByText('Precio guardado')

  expect(queryClient.getQueryState(catalogQueryOptions().queryKey)?.isInvalidated).toBe(true)
})

test('a repeated date is refused under "Rige desde" and keeps what was typed', async () => {
  const user = userEvent.setup()
  const { router } = await renderOpened(api({
      'POST /varieties/1/prices': () => jsonResponse(409, { code: 'variety.duplicate_effective_date' }),
    }),
  )

  await user.type(await screen.findByLabelText(/^Precio de lista/), '12000')
  await user.click(screen.getByRole('button', { name: 'Guardá el precio' }))

  const alert = await screen.findByText('Ya cargaste un precio con esa fecha')
  expect(alert.closest('.campo')).toHaveTextContent('Rige desde')
  expect(alert.closest('.campo')).toContainElement(screen.getByRole('button', { name: 'Hoy 02/10' }))
  expect(screen.getByLabelText(/^Precio de lista/)).toHaveValue('12000')
  expect(router.state.location.pathname).toBe(NEW_PATH)
})

test('an invalid price set is refused under "Precio de lista"', async () => {
  const user = userEvent.setup()
  await renderOpened(api({ 'POST /varieties/1/prices': () => jsonResponse(422, { code: 'variety.price_entry_invalid' }) }),
  )

  await user.type(await screen.findByLabelText(/^Precio de lista/), '12000')
  await user.click(screen.getByRole('button', { name: 'Guardá el precio' }))

  const alert = await screen.findByText('Revisá los precios cargados')
  expect(alert.closest('label')).toHaveTextContent('Precio de lista')
})

test('a grams refusal is shown under "Mínimo en gramos"', async () => {
  const user = userEvent.setup()
  await renderOpened(api({ 'POST /varieties/1/prices': () => jsonResponse(422, { code: 'grams.invalid' }) }),
  )

  await user.type(await screen.findByLabelText(/^Precio de lista/), '12000')
  await user.click(screen.getByRole('button', { name: 'Guardá el precio' }))

  const alert = await screen.findByText('Revisá los gramos cargados')
  expect(alert.closest('label')).toHaveTextContent('Mínimo en gramos')
})

test('an amount that is not a number is refused under its field and nothing is sent', async () => {
  const user = userEvent.setup()
  const { fetchMock } = await renderOpened(api())

  await user.type(await screen.findByLabelText(/^Precio de lista/), 'abc')
  await user.click(screen.getByRole('button', { name: 'Guardá el precio' }))

  expect((await screen.findByText('Revisá los precios cargados')).closest('label')).toHaveTextContent(
    'Precio de lista',
  )
  expect(writes(fetchMock)).toEqual([])
})

test('an untouched form closes at once, back to the page that opened it', async () => {
  const user = userEvent.setup()
  const { router } = await renderOpened(api())

  await user.click(await screen.findByRole('button', { name: 'Cerrar' }))

  expect(await screen.findByText('Página de la variedad')).toBeInTheDocument()
  expect(router.state.location.pathname).toBe(VARIETY_PATH)
})

test('with no history, "Cerrar" goes to the variety\'s page', async () => {
  const user = userEvent.setup()
  const { router } = renderVarieties([NEW_PATH], api())

  await user.click(await screen.findByRole('button', { name: 'Cerrar' }))

  expect(await screen.findByText('Página de la variedad')).toBeInTheDocument()
  expect(router.state.location.pathname).toBe(VARIETY_PATH)
})

test('closing with something typed asks first; staying keeps it, discarding saves nothing', async () => {
  const user = userEvent.setup()
  const { router, fetchMock } = await renderOpened(api())

  await user.type(await screen.findByLabelText(/^Precio de lista/), '12000')
  await user.click(screen.getByRole('button', { name: 'Cerrar' }))
  expect(await screen.findByText('¿Descartás el precio?')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'No, seguí cargando' }))

  expect(screen.queryByText('¿Descartás el precio?')).not.toBeInTheDocument()
  expect(screen.getByLabelText(/^Precio de lista/)).toHaveValue('12000')
  expect(router.state.location.pathname).toBe(NEW_PATH)

  await user.click(screen.getByRole('button', { name: 'Cerrar' }))
  await user.click(await screen.findByRole('button', { name: 'Sí, descartalo' }))

  expect(await screen.findByText('Página de la variedad')).toBeInTheDocument()
  expect(writes(fetchMock)).toEqual([])
})

test('a variety that is gone says "Eso ya no está." and goes back to Variedades', async () => {
  renderVarieties(
    [NEW_PATH],
    api({ 'GET /varieties/1': () => jsonResponse(404, { code: 'variety.not_found' }) }),
  )

  expect(await screen.findByText('Eso ya no está.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Volver a Variedades' })).toBeInTheDocument()
})

test('a variety that vanishes while saving shows the gone screen', async () => {
  const user = userEvent.setup()
  await renderOpened(api({ 'POST /varieties/1/prices': () => jsonResponse(404, { code: 'variety.not_found' }) }),
  )

  await user.type(await screen.findByLabelText(/^Precio de lista/), '12000')
  await user.click(screen.getByRole('button', { name: 'Guardá el precio' }))

  expect(await screen.findByText('Eso ya no está.')).toBeInTheDocument()
})

test('the form keeps the icon and text rule, its help lines within their limits', async () => {
  await renderOpened(api({}))

  await screen.findByRole('button', { name: 'Hoy 02/10' })
  expect(document.querySelectorAll('[data-copy="help"]')).toHaveLength(4)
  expectIconAndTextRule(screen.getByRole('main'), { limits: LIMITS })
})

const SETTINGS_URL = 'GET /pricing-settings'

function switches(bulk: boolean, vip: boolean): Record<string, () => Response> {
  return { [SETTINGS_URL]: () => jsonResponse(200, { is_bulk_pricing: bulk, is_vip_customers: vip }) }
}

test('with Clientes VIP on, a typed "Precio VIP" is sent beside the amounts', async () => {
  const user = userEvent.setup()
  const { fetchMock } = renderVarieties(
    [pathTo(VARIETY, { id: 1 }), NEW_PATH],
    api({ 'POST /varieties/1/prices': () => CREATED.clone() }),
  )

  await user.type(await screen.findByLabelText(/^Precio de lista/), '12000')
  await user.type(screen.getByLabelText(/^Precio VIP/), '9000')
  await user.click(screen.getByRole('button', { name: 'Guardá el precio' }))

  await screen.findByText('Precio guardado')
  expect(writes(fetchMock)[0]?.body).toEqual({
    effective_from: ME.today,
    list_price: 12000,
    vip_price: 9000,
  })
})

test('with Clientes VIP off the form has no "Precio VIP" and says nothing about it', async () => {
  const user = userEvent.setup()
  const { fetchMock } = renderVarieties(
    [pathTo(VARIETY, { id: 1 }), NEW_PATH],
    api({ ...switches(true, false), 'POST /varieties/1/prices': () => CREATED.clone() }),
  )

  await user.type(await screen.findByLabelText(/^Precio de lista/), '12000')
  expect(screen.queryByLabelText(/Precio VIP/)).not.toBeInTheDocument()
  expect(screen.queryByText(/VIP/)).not.toBeInTheDocument()
  expect(screen.getByLabelText(/^Precio por cantidad/)).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Guardá el precio' }))

  await screen.findByText('Precio guardado')
  expect(writes(fetchMock)[0]?.body).toEqual({ effective_from: ME.today, list_price: 12000 })
})

test('with Precio por cantidad off the form has no bulk price or minimum and says nothing about them', async () => {
  const user = userEvent.setup()
  const { fetchMock } = renderVarieties(
    [pathTo(VARIETY, { id: 1 }), NEW_PATH],
    api({ ...switches(false, true), 'POST /varieties/1/prices': () => CREATED.clone() }),
  )

  await user.type(await screen.findByLabelText(/^Precio de lista/), '12000')
  expect(screen.queryByLabelText(/Precio por cantidad/)).not.toBeInTheDocument()
  expect(screen.queryByLabelText(/Mínimo en gramos/)).not.toBeInTheDocument()
  expect(screen.queryByText(/cantidad/i)).not.toBeInTheDocument()
  expect(screen.getByLabelText(/^Precio VIP/)).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Guardá el precio' }))

  await screen.findByText('Precio guardado')
  expect(writes(fetchMock)[0]?.body).toEqual({ effective_from: ME.today, list_price: 12000 })
})

test('with both rules off only the list price is asked for', async () => {
  renderVarieties([pathTo(VARIETY, { id: 1 }), NEW_PATH], api(switches(false, false)))

  await screen.findByLabelText(/^Precio de lista/)

  expect(screen.queryByLabelText(/Precio VIP/)).not.toBeInTheDocument()
  expect(screen.queryByLabelText(/Precio por cantidad/)).not.toBeInTheDocument()
  expect(screen.queryByLabelText(/Mínimo en gramos/)).not.toBeInTheDocument()
})

test('a VIP price at or above list is refused inline under its field and keeps what was typed', async () => {
  const user = userEvent.setup()
  renderVarieties(
    [pathTo(VARIETY, { id: 1 }), NEW_PATH],
    api({
      'POST /varieties/1/prices': () => jsonResponse(422, { code: 'variety.vip_price_not_below_list' }),
    }),
  )

  await user.type(await screen.findByLabelText(/^Precio de lista/), '12000')
  await user.type(screen.getByLabelText(/^Precio VIP/), '12000')
  await user.click(screen.getByRole('button', { name: 'Guardá el precio' }))

  const message = await screen.findByText('El precio VIP tiene que ser menor al precio de lista')
  expect(message).toBeInTheDocument()
  expect(message.textContent).not.toMatch(/\d/)
  expect(screen.getByLabelText(/^Precio VIP/)).toHaveValue('12000')
  expect(screen.getByLabelText(/^Precio de lista/)).toHaveValue('12000')
})

test('a VIP price that is not a whole amount is refused before sending', async () => {
  const user = userEvent.setup()
  const { fetchMock } = renderVarieties([pathTo(VARIETY, { id: 1 }), NEW_PATH], api())

  await user.type(await screen.findByLabelText(/^Precio de lista/), '12000')
  await user.type(screen.getByLabelText(/^Precio VIP/), 'abc')
  await user.click(screen.getByRole('button', { name: 'Guardá el precio' }))

  expect(await screen.findByText('Revisá los precios cargados')).toBeInTheDocument()
  expect(writes(fetchMock)).toEqual([])
})

test('a "$" goes before the list, bulk and VIP price and never before the minimum, outside the name and the value', async () => {
  const user = userEvent.setup()
  await renderOpened(api({}))

  const amounts = [/^Precio de lista/, /^Precio por cantidad/, /^Precio VIP/]
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
  const minimum = screen.getByLabelText(/^Mínimo en gramos/)
  expect(minimum.parentElement).not.toHaveClass('campo__monto')
  expect(minimum.closest('.campo')).not.toHaveTextContent('$')
})

const CHIP_TODAY = { name: 'Hoy 02/10' }

test('the date is a chip reading "Hoy dd/mm" with "Rige desde" as its description, not its name', async () => {
  await renderOpened(api({}))

  const chip = await screen.findByRole('button', CHIP_TODAY)
  expect(chip).toHaveAccessibleDescription('Rige desde')
  expect(chip).toHaveAttribute('aria-expanded', 'false')
  expect(screen.queryByRole('button', { name: /Rige desde/ })).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Rige desde')).not.toBeInTheDocument()
})

test('picking another day reads "dd/mm" on the chip, and "Hoy" from the chip goes back to today', async () => {
  const user = userEvent.setup()
  await renderOpened(api({}))

  await user.click(await screen.findByRole('button', CHIP_TODAY))
  const input = screen.getByLabelText('Rige desde', { exact: true })
  expect(screen.getByLabelText('Rige desde')).toBe(input)
  expect(input).toHaveAttribute('type', 'date')
  expect(input).toHaveValue(ME.today)
  fireEvent.change(input, { target: { value: '2026-10-09' } })

  const chip = await screen.findByRole('button', { name: '09/10' })
  expect(chip).toHaveAttribute('aria-expanded', 'false')
  expect(document.querySelector('input[type=date]')).toBeNull()

  await user.click(chip)
  await user.click(screen.getByRole('button', { name: 'Hoy' }))
  expect(await screen.findByRole('button', CHIP_TODAY)).toBeInTheDocument()
  expect(document.querySelector('input[type=date]')).toBeNull()
})

test('a save at today\'s date never puts a date input in the DOM', async () => {
  const user = userEvent.setup()
  await renderOpened(api({ 'POST /varieties/1/prices': () => CREATED.clone() }))

  await user.type(await screen.findByLabelText(/^Precio de lista/), '12000')
  expect(document.querySelector('input[type=date]')).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Guardá el precio' }))

  await screen.findByText('Precio guardado')
  expect(document.querySelector('input[type=date]')).toBeNull()
})

test('a refused save keeps the chosen date, and a save sends it', async () => {
  const user = userEvent.setup()
  let calls = 0
  const { fetchMock } = await renderOpened(api({
    'POST /varieties/1/prices': () =>
      ++calls === 1 ? jsonResponse(409, { code: 'variety.duplicate_effective_date' }) : CREATED.clone(),
  }))

  await user.click(await screen.findByRole('button', CHIP_TODAY))
  fireEvent.change(screen.getByLabelText('Rige desde', { exact: true }), { target: { value: '2026-09-20' } })
  await user.type(await screen.findByLabelText(/^Precio de lista/), '12000')
  await user.click(screen.getByRole('button', { name: 'Guardá el precio' }))

  expect(await screen.findByText('Ya cargaste un precio con esa fecha')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '20/09' })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Guardá el precio' }))

  await screen.findByText('Precio guardado')
  expect(writes(fetchMock).map((write) => write.body)).toEqual([
    { effective_from: '2026-09-20', list_price: 12000 },
    { effective_from: '2026-09-20', list_price: 12000 },
  ])
})

test('another day counts as typed: leaving asks first', async () => {
  const user = userEvent.setup()
  await renderOpened(api())

  await user.click(await screen.findByRole('button', CHIP_TODAY))
  fireEvent.change(screen.getByLabelText('Rige desde', { exact: true }), { target: { value: '2026-10-09' } })
  await user.click(screen.getByRole('button', { name: 'Cerrar' }))

  expect(await screen.findByText('¿Descartás el precio?')).toBeInTheDocument()
})
