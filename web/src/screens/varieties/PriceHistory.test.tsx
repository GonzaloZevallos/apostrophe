/**
 * `PriceHistory` (`VerTodas`) at the screen seam: a variety's whole price history,
 * newest first, with "Rige desde", and each row's delete through "Antes de borrar".
 * The API is faked at `fetch`.
 */

import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { catalogQueryOptions } from '../../api/catalog'
import { VARIETY, VARIETY_PRICES } from '../../routes'
import { VARIETY_ROW, api, jsonResponse, renderVarieties, writes } from './renderVarieties'

afterEach(() => {
  vi.unstubAllGlobals()
})

test('lists every price newest first with "Rige desde", the one in force and its bulk tier', async () => {
  renderVarieties([VARIETY_PRICES(1)], api())

  expect(await screen.findByRole('link', { name: '‹ 24K Gold' })).toBeInTheDocument()
  const rows = (await screen.findAllByText(/^Rige desde/)).map((node) => node.textContent)
  expect(rows).toEqual(['Rige desde 25/09Vigente hoy', 'Rige desde 01/09', 'Rige desde 05/07'])
  expect(screen.getByText('Vigente hoy')).toBeInTheDocument()
  expect(screen.getByText('Desde 10 g · $ 10.000')).toBeInTheDocument()
  expect(screen.getByText('$ 11.000')).toBeInTheDocument()
  expect(screen.getAllByRole('button', { name: 'Borrar este precio' })).toHaveLength(3)
  expect(screen.getByText('Cada venta usa el precio que regía ese día, aunque lo cambies después.')).toBeInTheDocument()
})

test('back goes by history to where the seller came from', async () => {
  const user = userEvent.setup()
  const { router } = renderVarieties([VARIETY(1), VARIETY_PRICES(1)], api())

  await user.click(await screen.findByRole('link', { name: '‹ 24K Gold' }))

  expect(await screen.findByText('Página de la variedad')).toBeInTheDocument()
  expect(router.state.location.pathname).toBe(VARIETY(1))
  expect(router.state.historyAction).toBe('POP')
})

test('back with no history goes to the variety\'s page', async () => {
  const user = userEvent.setup()
  const { router } = renderVarieties([VARIETY_PRICES(1)], api())

  await user.click(await screen.findByRole('link', { name: '‹ 24K Gold' }))

  expect(await screen.findByText('Página de la variedad')).toBeInTheDocument()
  expect(router.state.location.pathname).toBe(VARIETY(1))
})

test('deleting says what takes the entry\'s place, then toasts "Precio eliminado"', async () => {
  const user = userEvent.setup()
  const { fetchMock } = renderVarieties(
    [VARIETY_PRICES(1)],
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
    [VARIETY_PRICES(1)],
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
    [VARIETY_PRICES(1)],
    api({
      'GET /varieties/1': () => jsonResponse(404, { code: 'variety.not_found' }),
      'GET /varieties/1/prices': () => jsonResponse(404, { code: 'variety.not_found' }),
    }),
  )

  expect(await screen.findByText('Eso ya no está.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Volver a Variedades' })).toBeInTheDocument()
})

test('an id that is not a number is gone too, and asks the API nothing', async () => {
  const { fetchMock } = renderVarieties(['/varieties/abc/prices'], api())

  expect(await screen.findByText('Eso ya no está.')).toBeInTheDocument()
  expect(fetchMock).not.toHaveBeenCalled()
})

test('a delete that finds the price gone says so and refreshes the list', async () => {
  const user = userEvent.setup()
  renderVarieties(
    [VARIETY_PRICES(1)],
    api({ 'DELETE /varieties/1/prices/3': () => jsonResponse(404, { code: 'variety.price_entry_not_found' }) }),
  )

  const buttons = await screen.findAllByRole('button', { name: 'Borrar este precio' })
  await user.click(buttons[0]!)
  await user.click(await screen.findByRole('button', { name: 'Sí, borrala' }))

  expect(await screen.findByText('Eso ya no está. La lista ya está al día.')).toBeInTheDocument()
})

test("an archived variety's price history is read-only: rows with no delete", async () => {
  renderVarieties(
    [VARIETY_PRICES(1)],
    api({ 'GET /varieties/1': () => jsonResponse(200, { ...VARIETY_ROW, archived: true }) }),
  )

  expect(await screen.findAllByText(/^Rige desde/)).toHaveLength(3)
  expect(screen.queryByRole('button', { name: 'Borrar este precio' })).toBeNull()
})
