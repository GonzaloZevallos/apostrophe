/**
 * The withdrawal detail screen (route `/withdrawals/:id`) through Testing Library, `fetch`
 * faked with the withdrawal fixture: its chrome, what it shows, "Editar" opening the
 * filled form with a confirmed save, "Borrar" with its fixed text and toast, and both
 * "Eso ya no está." forms (`stock.md`, "A withdrawal's detail").
 */

import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import WITHDRAWAL from '../../api/fixtures/withdrawal.json'
import { jsonResponse, renderWithdrawals, type FetchImpl } from './renderWithdrawals'

afterEach(() => {
  vi.unstubAllGlobals()
})

const OWN_USE = { ...WITHDRAWAL, reason: 'own_use', note: null }

function serving(body: unknown, extra?: FetchImpl): FetchImpl {
  return async (url, init) => {
    if (url === '/stock/withdrawals/1' && (init?.method === undefined || init.method === 'GET')) {
      return jsonResponse(200, body)
    }
    return extra === undefined ? jsonResponse(404, {}) : extra(url, init)
  }
}

test('shows the date, the reason by word, every line and the note, with the bar and no "+ Nueva venta"', async () => {
  renderWithdrawals(['/variedades', '/withdrawals/1'], serving(WITHDRAWAL))

  expect(await screen.findByText('Zkittlez')).toBeInTheDocument()
  expect(screen.getByText('Promoción')).toBeInTheDocument()
  expect(screen.getByText('02/10')).toBeInTheDocument()
  expect(screen.getByText('5,5 g')).toBeInTheDocument()
  expect(screen.getByText('Para la fiesta')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Editar' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Borrar' })).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: /Nueva venta/ })).not.toBeInTheDocument()
  expect(document.querySelector('.bar-inferior')).not.toBeNull()
})

test('the "‹" back goes to the page it was opened from', async () => {
  const { router } = renderWithdrawals(['/variedades', '/withdrawals/1'], serving(WITHDRAWAL))

  await userEvent.click(await screen.findByRole('button', { name: 'Volver' }))

  await waitFor(() => expect(router.state.location.pathname).toBe('/variedades'))
})

test('with no history, back goes to Variedades', async () => {
  const { router } = renderWithdrawals(['/withdrawals/1'], serving(WITHDRAWAL))

  await userEvent.click(await screen.findByRole('button', { name: 'Volver' }))

  await waitFor(() => expect(router.state.location.pathname).toBe('/variedades'))
})

test('Borrar names the promotion, the date and the grams; confirming deletes and toasts "Retiro eliminado"', async () => {
  const deletes = vi.fn()
  const { router } = renderWithdrawals(
    ['/variedades', '/withdrawals/1'],
    serving(WITHDRAWAL, async (url, init) => {
      if (url === '/stock/withdrawals/1' && init?.method === 'DELETE') {
        deletes()
        return new Response(null, { status: 204 })
      }
      return jsonResponse(404, {})
    }),
  )
  await userEvent.click(await screen.findByRole('button', { name: 'Borrar' }))

  const dialog = await screen.findByRole('alertdialog', { name: 'Antes de borrar' })
  expect(dialog).toHaveTextContent('¿Borrás la promoción del 02/10? Vuelven 5,5 g al stock.')
  await userEvent.click(within(dialog).getByRole('button', { name: 'No, dejalo' }))
  expect(deletes).not.toHaveBeenCalled()

  await userEvent.click(screen.getByRole('button', { name: 'Borrar' }))
  await userEvent.click(
    within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Sí, borralo' }),
  )

  expect(await screen.findByText('Retiro eliminado')).toBeInTheDocument()
  expect(router.state.location.pathname).toBe('/variedades')
  expect(deletes).toHaveBeenCalledTimes(1)
})

test('Borrar on an own-use withdrawal says "el consumo propio"', async () => {
  renderWithdrawals(['/variedades', '/withdrawals/1'], serving(OWN_USE))

  await userEvent.click(await screen.findByRole('button', { name: 'Borrar' }))

  expect(await screen.findByRole('alertdialog')).toHaveTextContent(
    '¿Borrás el consumo propio del 02/10? Vuelven 5,5 g al stock.',
  )
})

test('Editar opens the form filled in; saving is confirmed first and toasts "Retiro guardado"', async () => {
  const puts: unknown[] = []
  const { router } = renderWithdrawals(
    ['/variedades', '/withdrawals/1'],
    serving(WITHDRAWAL, async (url, init) => {
      if (url === '/stock/withdrawals/1' && init?.method === 'PUT') {
        puts.push(JSON.parse(String(init.body)))
        return jsonResponse(200, WITHDRAWAL)
      }
      return jsonResponse(404, {})
    }),
  )
  await userEvent.click(await screen.findByRole('link', { name: 'Editar' }))

  expect(await screen.findByLabelText('Gramos 1')).toHaveValue('5.5')
  expect(screen.getByLabelText('Nota')).toHaveValue('Para la fiesta')
  expect(screen.getByRole('button', { name: 'Promoción' })).toHaveAttribute('aria-pressed', 'true')
  await userEvent.clear(screen.getByLabelText('Gramos 1'))
  await userEvent.type(screen.getByLabelText('Gramos 1'), '6')
  await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
  expect(puts).toEqual([])

  await userEvent.click(
    within(await screen.findByRole('alertdialog', { name: '¿Guardás los cambios?' })).getByRole(
      'button',
      { name: 'Sí, guardar' },
    ),
  )

  expect(await screen.findByText('Retiro guardado')).toBeInTheDocument()
  expect(router.state.location.pathname).toBe('/withdrawals/1')
  expect(puts).toEqual([
    {
      reason: 'promotion',
      date: '2026-10-02',
      lines: [{ variety_id: 1, grams: '6' }],
      note: 'Para la fiesta',
    },
  ])
})

test('opening a withdrawal that is gone shows "Eso ya no está." and "Volver a Variedades"', async () => {
  renderWithdrawals(['/withdrawals/1'], async () => jsonResponse(404, { code: 'stock.withdrawal_not_found' }))

  expect(await screen.findByText('Eso ya no está.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Volver a Variedades' })).toHaveAttribute('href', '/variedades')
})

test('deleting a withdrawal that is gone goes to Variedades with "Eso ya no está. La lista ya está al día."', async () => {
  const { router } = renderWithdrawals(
    ['/variedades', '/withdrawals/1'],
    serving(WITHDRAWAL, async (url, init) =>
      url === '/stock/withdrawals/1' && init?.method === 'DELETE'
        ? jsonResponse(404, { code: 'stock.withdrawal_not_found' })
        : jsonResponse(404, {}),
    ),
  )
  await userEvent.click(await screen.findByRole('button', { name: 'Borrar' }))
  await userEvent.click(
    within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Sí, borralo' }),
  )

  expect(await screen.findByText('Eso ya no está. La lista ya está al día.')).toBeInTheDocument()
  expect(router.state.location.pathname).toBe('/variedades')
})
