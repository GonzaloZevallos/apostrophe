/**
 * `PriceNew` (`PrecioNuevo`) at the screen seam: the price form on its own route, through
 * the real data router with `fetch` faked. A refusal shows under the field it is about and
 * keeps what was typed; "Cerrar" and a save go back by history, else to the variety's page;
 * leaving with something typed asks first.
 */

import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { catalogQueryOptions } from '../../api/catalog'
import { VARIETY, VARIETY_PRICE_NEW } from '../../legacyVarietyPaths'
import { ME, api, jsonResponse, renderVarieties, writes } from './renderVarieties'

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
  const { router, fetchMock } = renderVarieties(
    [VARIETY(1), VARIETY_PRICE_NEW(1)],
    api({ 'POST /varieties/1/prices': () => CREATED.clone() }),
  )

  expect(await screen.findByLabelText('Rige desde')).toHaveValue(ME.today)
  await user.type(screen.getByLabelText(/^Precio de lista/), '12000')
  await user.click(screen.getByRole('button', { name: 'Guardá el precio' }))

  expect(await screen.findByText('Página de la variedad')).toBeInTheDocument()
  expect(router.state.location.pathname).toBe(VARIETY(1))
  expect(await screen.findAllByText('Precio guardado')).toHaveLength(1)
  expect(writes(fetchMock)).toEqual([
    { call: 'POST /varieties/1/prices', body: { effective_from: ME.today, list_price: 12000 } },
  ])
})

test('a save sends the bulk tier when one is typed', async () => {
  const user = userEvent.setup()
  const { fetchMock } = renderVarieties(
    [VARIETY(1), VARIETY_PRICE_NEW(1)],
    api({ 'POST /varieties/1/prices': () => CREATED.clone() }),
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
  const { queryClient } = renderVarieties(
    [VARIETY(1), VARIETY_PRICE_NEW(1)],
    api({ 'POST /varieties/1/prices': () => CREATED.clone() }),
  )
  queryClient.setQueryData(catalogQueryOptions().queryKey, { text: null, header: '', footer: '', varieties: [] })

  await user.type(await screen.findByLabelText(/^Precio de lista/), '12000')
  await user.click(screen.getByRole('button', { name: 'Guardá el precio' }))
  await screen.findByText('Precio guardado')

  expect(queryClient.getQueryState(catalogQueryOptions().queryKey)?.isInvalidated).toBe(true)
})

test('a repeated date is refused under "Rige desde" and keeps what was typed', async () => {
  const user = userEvent.setup()
  const { router } = renderVarieties(
    [VARIETY(1), VARIETY_PRICE_NEW(1)],
    api({
      'POST /varieties/1/prices': () => jsonResponse(409, { code: 'variety.duplicate_effective_date' }),
    }),
  )

  await user.type(await screen.findByLabelText(/^Precio de lista/), '12000')
  await user.click(screen.getByRole('button', { name: 'Guardá el precio' }))

  const alert = await screen.findByText('Ya cargaste un precio con esa fecha')
  expect(alert.closest('label')).toHaveTextContent('Rige desde')
  expect(screen.getByLabelText(/^Precio de lista/)).toHaveValue('12000')
  expect(router.state.location.pathname).toBe(VARIETY_PRICE_NEW(1))
})

test('an invalid price set is refused under "Precio de lista"', async () => {
  const user = userEvent.setup()
  renderVarieties(
    [VARIETY(1), VARIETY_PRICE_NEW(1)],
    api({ 'POST /varieties/1/prices': () => jsonResponse(422, { code: 'variety.price_entry_invalid' }) }),
  )

  await user.type(await screen.findByLabelText(/^Precio de lista/), '12000')
  await user.click(screen.getByRole('button', { name: 'Guardá el precio' }))

  const alert = await screen.findByText('Revisá los precios cargados')
  expect(alert.closest('label')).toHaveTextContent('Precio de lista')
})

test('a grams refusal is shown under "Mínimo en gramos"', async () => {
  const user = userEvent.setup()
  renderVarieties(
    [VARIETY(1), VARIETY_PRICE_NEW(1)],
    api({ 'POST /varieties/1/prices': () => jsonResponse(422, { code: 'grams.invalid' }) }),
  )

  await user.type(await screen.findByLabelText(/^Precio de lista/), '12000')
  await user.click(screen.getByRole('button', { name: 'Guardá el precio' }))

  const alert = await screen.findByText('Revisá los gramos cargados')
  expect(alert.closest('label')).toHaveTextContent('Mínimo en gramos')
})

test('an amount that is not a number is refused under its field and nothing is sent', async () => {
  const user = userEvent.setup()
  const { fetchMock } = renderVarieties([VARIETY(1), VARIETY_PRICE_NEW(1)], api())

  await user.type(await screen.findByLabelText(/^Precio de lista/), 'abc')
  await user.click(screen.getByRole('button', { name: 'Guardá el precio' }))

  expect((await screen.findByText('Revisá los precios cargados')).closest('label')).toHaveTextContent(
    'Precio de lista',
  )
  expect(writes(fetchMock)).toEqual([])
})

test('an untouched form closes at once, back to the page that opened it', async () => {
  const user = userEvent.setup()
  const { router } = renderVarieties([VARIETY(1), VARIETY_PRICE_NEW(1)], api())

  await user.click(await screen.findByRole('button', { name: 'Cerrar' }))

  expect(await screen.findByText('Página de la variedad')).toBeInTheDocument()
  expect(router.state.location.pathname).toBe(VARIETY(1))
})

test('with no history, "Cerrar" goes to the variety\'s page', async () => {
  const user = userEvent.setup()
  const { router } = renderVarieties([VARIETY_PRICE_NEW(1)], api())

  await user.click(await screen.findByRole('button', { name: 'Cerrar' }))

  expect(await screen.findByText('Página de la variedad')).toBeInTheDocument()
  expect(router.state.location.pathname).toBe(VARIETY(1))
})

test('closing with something typed asks first; staying keeps it, discarding saves nothing', async () => {
  const user = userEvent.setup()
  const { router, fetchMock } = renderVarieties([VARIETY(1), VARIETY_PRICE_NEW(1)], api())

  await user.type(await screen.findByLabelText(/^Precio de lista/), '12000')
  await user.click(screen.getByRole('button', { name: 'Cerrar' }))
  expect(await screen.findByText('¿Descartás el precio?')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'No, seguí cargando' }))

  expect(screen.queryByText('¿Descartás el precio?')).not.toBeInTheDocument()
  expect(screen.getByLabelText(/^Precio de lista/)).toHaveValue('12000')
  expect(router.state.location.pathname).toBe(VARIETY_PRICE_NEW(1))

  await user.click(screen.getByRole('button', { name: 'Cerrar' }))
  await user.click(await screen.findByRole('button', { name: 'Sí, descartalo' }))

  expect(await screen.findByText('Página de la variedad')).toBeInTheDocument()
  expect(writes(fetchMock)).toEqual([])
})

test('a variety that is gone says "Eso ya no está." and goes back to Variedades', async () => {
  renderVarieties(
    [VARIETY_PRICE_NEW(1)],
    api({ 'GET /varieties/1': () => jsonResponse(404, { code: 'variety.not_found' }) }),
  )

  expect(await screen.findByText('Eso ya no está.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Volver a Variedades' })).toBeInTheDocument()
})

test('a variety that vanishes while saving shows the gone screen', async () => {
  const user = userEvent.setup()
  renderVarieties(
    [VARIETY(1), VARIETY_PRICE_NEW(1)],
    api({ 'POST /varieties/1/prices': () => jsonResponse(404, { code: 'variety.not_found' }) }),
  )

  await user.type(await screen.findByLabelText(/^Precio de lista/), '12000')
  await user.click(screen.getByRole('button', { name: 'Guardá el precio' }))

  expect(await screen.findByText('Eso ya no está.')).toBeInTheDocument()
})
