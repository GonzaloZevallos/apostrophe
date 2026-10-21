/**
 * The withdrawal detail screen (route `/withdrawals/:id`) through Testing Library, `fetch`
 * faked with the withdrawal fixture: its chrome, what it shows, "Edit" opening the
 * filled form with a confirmed save, "Borrar" with its fixed text and toast, and both
 * "That is gone." forms (`stock.md`, "A withdrawal's detail").
 */

import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import WITHDRAWAL from '../../api/fixtures/withdrawal.json'
import { VARIETIES as VARIETIES_PATH, WITHDRAWAL as WITHDRAWAL_PATH, pathTo } from '../../routes'
import { jsonResponse, renderWithdrawals, type FetchImpl } from './renderWithdrawals'
import { LIMITS } from '../../copy/limits'
import { expectIconAndTextRule } from '../../test/iconAndTextRule'

const ONE = pathTo(WITHDRAWAL_PATH, { id: 1 })

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
  renderWithdrawals([VARIETIES_PATH, ONE], serving(WITHDRAWAL))

  expect(await screen.findByText('Zkittlez')).toBeInTheDocument()
  expect(screen.getByText('Promotion')).toBeInTheDocument()
  expect(screen.getByText('02/10')).toBeInTheDocument()
  expect(screen.getByText('5,5 g')).toBeInTheDocument()
  expect(screen.getByText('Para la fiesta')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Edit' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Borrar' })).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: /New sale/ })).not.toBeInTheDocument()
  expect(document.querySelector('.bar-inferior')).not.toBeNull()
})

test('the "‹" back goes to the page it was opened from', async () => {
  const { router } = renderWithdrawals([VARIETIES_PATH, ONE], serving(WITHDRAWAL))

  await userEvent.click(await screen.findByRole('button', { name: '‹ Varieties' }))

  await waitFor(() => expect(router.state.location.pathname).toBe(VARIETIES_PATH))
})

test('with no history, back goes to Variedades', async () => {
  const { router } = renderWithdrawals([ONE], serving(WITHDRAWAL))

  await userEvent.click(await screen.findByRole('button', { name: '‹ Varieties' }))

  await waitFor(() => expect(router.state.location.pathname).toBe(VARIETIES_PATH))
})

test('Borrar names the promotion, the date and the grams; confirming deletes and toasts "Retiro eliminado"', async () => {
  const deletes = vi.fn()
  const { router } = renderWithdrawals(
    [VARIETIES_PATH, ONE],
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
  await userEvent.click(within(dialog).getByRole('button', { name: 'No, keep it' }))
  expect(deletes).not.toHaveBeenCalled()

  await userEvent.click(screen.getByRole('button', { name: 'Borrar' }))
  await userEvent.click(
    within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Yes, delete it' }),
  )

  expect(await screen.findByText('Retiro eliminado')).toBeInTheDocument()
  expect(router.state.location.pathname).toBe(VARIETIES_PATH)
  expect(deletes).toHaveBeenCalledTimes(1)
})

test('Borrar on an own-use withdrawal says "el consumo propio"', async () => {
  renderWithdrawals([VARIETIES_PATH, ONE], serving(OWN_USE))

  await userEvent.click(await screen.findByRole('button', { name: 'Borrar' }))

  expect(await screen.findByRole('alertdialog')).toHaveTextContent(
    '¿Borrás el consumo propio del 02/10? Vuelven 5,5 g al stock.',
  )
})

test('Editar opens the form filled in; saving is confirmed first and toasts "Retiro guardado"', async () => {
  const puts: unknown[] = []
  const { router } = renderWithdrawals(
    [VARIETIES_PATH, ONE],
    serving(WITHDRAWAL, async (url, init) => {
      if (url === '/stock/withdrawals/1' && init?.method === 'PUT') {
        puts.push(JSON.parse(String(init.body)))
        return jsonResponse(200, WITHDRAWAL)
      }
      return jsonResponse(404, {})
    }),
  )
  await userEvent.click(await screen.findByRole('link', { name: 'Edit' }))

  expect(await screen.findByLabelText('Gramos 1')).toHaveValue('5.5')
  expect(screen.getByLabelText('Note')).toHaveValue('Para la fiesta')
  expect(screen.getByRole('button', { name: 'Promotion' })).toHaveAttribute('aria-pressed', 'true')
  await userEvent.clear(screen.getByLabelText('Gramos 1'))
  await userEvent.type(screen.getByLabelText('Gramos 1'), '6')
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))
  expect(puts).toEqual([])

  await userEvent.click(
    within(await screen.findByRole('alertdialog', { name: '¿Guardás los cambios?' })).getByRole(
      'button',
      { name: 'Sí, guardar' },
    ),
  )

  expect(await screen.findByText('Retiro guardado')).toBeInTheDocument()
  expect(router.state.location.pathname).toBe(ONE)
  expect(puts).toEqual([
    {
      reason: 'promotion',
      date: '2026-10-02',
      lines: [{ variety_id: 1, grams: '6' }],
      note: 'Para la fiesta',
    },
  ])
})

test('opening a withdrawal that is gone shows "That is gone." and "Back to Varieties"', async () => {
  renderWithdrawals([ONE], async () => jsonResponse(404, { code: 'stock.withdrawal_not_found' }))

  expect(await screen.findByText('That is gone.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Back to Varieties' })).toHaveAttribute('href', VARIETIES_PATH)
})

test('deleting a withdrawal that is gone goes to Variedades with "That is gone. The list is up to date."', async () => {
  const { router } = renderWithdrawals(
    [VARIETIES_PATH, ONE],
    serving(WITHDRAWAL, async (url, init) =>
      url === '/stock/withdrawals/1' && init?.method === 'DELETE'
        ? jsonResponse(404, { code: 'stock.withdrawal_not_found' })
        : jsonResponse(404, {}),
    ),
  )
  await userEvent.click(await screen.findByRole('button', { name: 'Borrar' }))
  await userEvent.click(
    within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Yes, delete it' }),
  )

  expect(await screen.findByText('That is gone. The list is up to date.')).toBeInTheDocument()
  expect(router.state.location.pathname).toBe(VARIETIES_PATH)
})

test('the detail keeps the icon and text rule: Borrar carries its icon and word, the back keeps its name', async () => {
  renderWithdrawals([VARIETIES_PATH, ONE], serving(WITHDRAWAL))

  const borrar = await screen.findByRole('button', { name: 'Borrar' })
  expect(borrar.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  expect(screen.getByRole('button', { name: '‹ Varieties' })).toBeInTheDocument()
  expectIconAndTextRule(screen.getByRole('main'), { limits: LIMITS })
})
