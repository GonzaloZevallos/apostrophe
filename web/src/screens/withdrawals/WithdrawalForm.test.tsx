/**
 * The withdrawal form screen (route `/withdrawals/new`) through Testing Library, `fetch`
 * faked at the network: its chrome and leave guard, the reason with no default, what a save
 * sends and toasts, and a refusal that keeps what was typed (`stock.md`, "Sacar del stock").
 */

import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import WITHDRAWAL from '../../api/fixtures/withdrawal.json'
import { jsonResponse, renderWithdrawals } from './renderWithdrawals'

afterEach(() => {
  vi.unstubAllGlobals()
})

async function openFromVariedades() {
  const view = renderWithdrawals(['/variedades'], async () => jsonResponse(404, {}))
  await userEvent.click(await screen.findByRole('link', { name: 'Sacar del stock' }))
  await screen.findByLabelText('Variedad 1')
  return view
}

test('is a form: Cerrar, no bar and no "+ Nueva venta"', async () => {
  await openFromVariedades()

  expect(screen.getByText('Sacar del stock')).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: /Nueva venta/ })).not.toBeInTheDocument()
  // the side rail is CSS-hidden on a phone; the bottom bar is what a form drops
  expect(document.querySelector('.bar-inferior')).toBeNull()
})

test('closing it untouched leaves without asking', async () => {
  const { router } = await openFromVariedades()

  await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }))

  await waitFor(() => expect(router.state.location.pathname).toBe('/variedades'))
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
})

test('closing it with something typed asks first, and discarding leaves', async () => {
  const { router } = await openFromVariedades()
  await userEvent.type(screen.getByLabelText('Nota'), 'Para la fiesta')

  await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }))

  const dialog = await screen.findByRole('alertdialog', { name: '¿Descartás el retiro?' })
  await userEvent.click(within(dialog).getByRole('button', { name: 'No, seguí cargando' }))
  expect(router.state.location.pathname).toBe('/withdrawals/new')
  expect(screen.getByLabelText('Nota')).toHaveValue('Para la fiesta')

  await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
  await userEvent.click(
    within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Sí, descartalo' }),
  )
  await waitFor(() => expect(router.state.location.pathname).toBe('/variedades'))
})

test('the reason has no default: saving stays off until one is chosen', async () => {
  await openFromVariedades()
  await userEvent.selectOptions(screen.getByLabelText('Variedad 1'), 'Zkittlez')
  await userEvent.type(screen.getByLabelText('Gramos 1'), '5')

  const promotion = screen.getByRole('button', { name: 'Promoción' })
  const ownUse = screen.getByRole('button', { name: 'Consumo propio' })
  expect(promotion).toHaveAttribute('aria-pressed', 'false')
  expect(ownUse).toHaveAttribute('aria-pressed', 'false')
  expect(screen.getByRole('button', { name: 'Guardá el retiro' })).toBeDisabled()

  await userEvent.click(ownUse)
  expect(ownUse).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: 'Guardá el retiro' })).toBeEnabled()
})

test('grams ask for the decimal keypad and the date never goes past today', async () => {
  await openFromVariedades()

  expect(screen.getByLabelText('Gramos 1')).toHaveAttribute('inputmode', 'decimal')
  expect(screen.getByLabelText('Fecha')).toHaveValue('2026-10-06')
  expect(screen.getByLabelText('Fecha')).toHaveAttribute('max', '2026-10-06')
})

test('?variety= chooses the first line\'s variety', async () => {
  renderWithdrawals(['/withdrawals/new?variety=2'], async () => jsonResponse(404, {}))

  expect(await screen.findByLabelText('Variedad 1')).toHaveValue('2')
  // chosen from the link, so nothing is typed yet: leaving asks nothing
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
})

test('saves with every line, a trimmed note, then shows "Retiro guardado" where it goes back', async () => {
  const requests: { url: string; method: string | undefined; body: unknown }[] = []
  const { router } = renderWithdrawals(['/variedades'], async (url, init) => {
    if (url === '/stock/withdrawals' && init?.method === 'POST') {
      requests.push({ url, method: init.method, body: JSON.parse(String(init.body)) })
      return jsonResponse(201, WITHDRAWAL)
    }
    return jsonResponse(404, {})
  })
  await userEvent.click(await screen.findByRole('link', { name: 'Sacar del stock' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Promoción' }))
  await userEvent.selectOptions(screen.getByLabelText('Variedad 1'), 'Zkittlez')
  await userEvent.type(screen.getByLabelText('Gramos 1'), '5,5')
  await userEvent.click(screen.getByRole('button', { name: 'Agregar otra variedad' }))
  await userEvent.selectOptions(screen.getByLabelText('Variedad 2'), 'Zkittlez')
  await userEvent.type(screen.getByLabelText('Gramos 2'), '1')
  await userEvent.type(screen.getByLabelText('Nota'), '  Para la fiesta ')

  await userEvent.click(screen.getByRole('button', { name: 'Guardá el retiro' }))

  expect(await screen.findByText('Retiro guardado')).toBeInTheDocument()
  expect(router.state.location.pathname).toBe('/variedades')
  expect(requests).toEqual([
    {
      url: '/stock/withdrawals',
      method: 'POST',
      body: {
        reason: 'promotion',
        date: '2026-10-06',
        lines: [
          { variety_id: 1, grams: '5.5' },
          { variety_id: 1, grams: '1' },
        ],
        note: 'Para la fiesta',
      },
    },
  ])
})

test('a refusal shows inline by its code and keeps everything typed', async () => {
  renderWithdrawals(['/variedades'], async (url, init) => {
    if (url === '/stock/withdrawals' && init?.method === 'POST') {
      return jsonResponse(422, { code: 'stock.withdrawal_grams_too_precise' })
    }
    return jsonResponse(404, {})
  })
  await userEvent.click(await screen.findByRole('link', { name: 'Sacar del stock' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Consumo propio' }))
  await userEvent.selectOptions(screen.getByLabelText('Variedad 1'), 'Gelato')
  await userEvent.type(screen.getByLabelText('Gramos 1'), '2,5')
  await userEvent.type(screen.getByLabelText('Nota'), 'mía')

  await userEvent.click(screen.getByRole('button', { name: 'Guardá el retiro' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Los gramos admiten hasta dos decimales')
  expect(screen.getByRole('button', { name: 'Consumo propio' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByLabelText('Variedad 1')).toHaveValue('2')
  expect(screen.getByLabelText('Gramos 1')).toHaveValue('2,5')
  expect(screen.getByLabelText('Nota')).toHaveValue('mía')
})

test('grams the front cannot read are refused inline without calling the API', async () => {
  const writes = vi.fn()
  renderWithdrawals(['/withdrawals/new'], async (_url, init) => {
    if (init?.method === 'POST') writes()
    return jsonResponse(404, {})
  })
  await userEvent.click(await screen.findByRole('button', { name: 'Promoción' }))
  await userEvent.selectOptions(screen.getByLabelText('Variedad 1'), 'Zkittlez')
  await userEvent.type(screen.getByLabelText('Gramos 1'), '0')

  await userEvent.click(screen.getByRole('button', { name: 'Guardá el retiro' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Revisá los gramos cargados')
  expect(writes).not.toHaveBeenCalled()
})

test('a send that finds the withdrawal gone goes to Variedades with the fixed notice', async () => {
  const { router } = renderWithdrawals(['/withdrawals/1/edit'], async (url, init) => {
    if (url === '/stock/withdrawals/1' && init?.method === 'PUT') {
      return jsonResponse(404, { code: 'stock.withdrawal_not_found' })
    }
    if (url === '/stock/withdrawals/1') return jsonResponse(200, WITHDRAWAL)
    return jsonResponse(404, {})
  })
  await userEvent.type(await screen.findByLabelText('Nota'), '!')
  await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
  await userEvent.click(
    within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Sí, guardar' }),
  )

  expect(await screen.findByText('Eso ya no está. La lista ya está al día.')).toBeInTheDocument()
  expect(router.state.location.pathname).toBe('/variedades')
})
