/**
 * The variety's full movements list (route `/variedades/:id/movimientos`, "Ver todas" under
 * "Stock y entradas") through Testing Library, `fetch` faked with the movements fixture: every
 * row told apart by word and sign, the detail chrome, and the gone state (`stock.md`).
 */

import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import MOVEMENTS from '../api/fixtures/movements.json'
import { jsonResponse, renderWithdrawals, type FetchImpl } from './withdrawals/renderWithdrawals'

afterEach(() => {
  vi.unstubAllGlobals()
})

const VARIETY = { id: 1, name: 'Zkittlez', current_price: null }

function serving(movementsStatus = 200): FetchImpl {
  return async (url) => {
    if (url === '/varieties/1') return jsonResponse(200, VARIETY)
    if (url === '/stock/varieties/1/movements') {
      return movementsStatus === 200
        ? jsonResponse(200, MOVEMENTS)
        : jsonResponse(movementsStatus, { code: 'variety.not_found' })
    }
    return jsonResponse(404, {})
  }
}

test('lists every movement, the withdrawal by reason word and minus sign, with the detail chrome', async () => {
  renderWithdrawals(['/variedades', '/variedades/1/movimientos'], serving())

  expect(await screen.findByText('01/10 · Promoción')).toBeInTheDocument()
  expect(screen.getByText('02/10 · Compra')).toBeInTheDocument()
  expect(screen.getByText('20 g')).toBeInTheDocument()
  expect(screen.getByText('01/10 · Promoción').closest('a')).toHaveTextContent('−5,5 g')
  expect(screen.getByText('Zkittlez')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Volver' })).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: /Nueva venta/ })).not.toBeInTheDocument()
  expect(document.querySelector('.bar-inferior')).not.toBeNull()
})

test('the back arrow returns by history', async () => {
  const user = userEvent.setup()
  const { router } = renderWithdrawals(['/variedades', '/variedades/1/movimientos'], serving())

  await user.click(await screen.findByRole('button', { name: 'Volver' }))
  expect(router.state.location.pathname).toBe('/variedades')
})

test('a variety that is gone shows "Eso ya no está." with the way back', async () => {
  renderWithdrawals(['/variedades/1/movimientos'], serving(404))

  expect(await screen.findByText('Eso ya no está.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Volver a Variedades' })).toBeInTheDocument()
})
