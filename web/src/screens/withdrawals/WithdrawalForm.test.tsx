/**
 * The withdrawal form screen (route `/withdrawals/new`) through Testing Library, `fetch`
 * faked at the network: its chrome and leave guard, the reason with no default, what a save
 * sends and toasts, and a refusal that keeps what was typed (`stock.md`, "Sacar del stock").
 */

import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import contract from '../../api/contract.json'
import WITHDRAWAL from '../../api/fixtures/withdrawal.json'
import { VARIETIES as VARIETIES_PATH, WITHDRAWAL_NEW, withdrawalNewFor } from '../../routes'
import { jsonResponse, renderWithdrawals } from './renderWithdrawals'
import { LIMITS } from '../../copy/limits'
import { expectIconAndTextRule } from '../../test/iconAndTextRule'

afterEach(() => {
  vi.unstubAllGlobals()
})

async function openFromVariedades() {
  const view = renderWithdrawals([VARIETIES_PATH], async () => jsonResponse(404, {}))
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

  await waitFor(() => expect(router.state.location.pathname).toBe(VARIETIES_PATH))
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
})

test('closing it with something typed asks first, and discarding leaves', async () => {
  const { router } = await openFromVariedades()
  await userEvent.type(screen.getByLabelText('Nota'), 'Para la fiesta')

  await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }))

  const dialog = await screen.findByRole('alertdialog', { name: '¿Descartás el retiro?' })
  await userEvent.click(within(dialog).getByRole('button', { name: 'No, seguí cargando' }))
  expect(router.state.location.pathname).toBe(WITHDRAWAL_NEW)
  expect(screen.getByLabelText('Nota')).toHaveValue('Para la fiesta')

  await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
  await userEvent.click(
    within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Sí, descartalo' }),
  )
  await waitFor(() => expect(router.state.location.pathname).toBe(VARIETIES_PATH))
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
  renderWithdrawals([withdrawalNewFor(2)], async () => jsonResponse(404, {}))

  expect(await screen.findByLabelText('Variedad 1')).toHaveValue('2')
  // chosen from the link, so nothing is typed yet: leaving asks nothing
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
})

test('saves with every line, a trimmed note, then shows "Retiro guardado" where it goes back', async () => {
  const requests: { url: string; method: string | undefined; body: unknown }[] = []
  const { router } = renderWithdrawals([VARIETIES_PATH], async (url, init) => {
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
  expect(router.state.location.pathname).toBe(VARIETIES_PATH)
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
  renderWithdrawals([VARIETIES_PATH], async (url, init) => {
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

const WITHDRAWAL_REFUSALS = [
  ['stock.withdrawal_reason_required', 422, 'Elegí el motivo: Promoción o Consumo propio'],
  ['stock.withdrawal_date_in_future', 422, 'La fecha no puede ser futura'],
  ['stock.withdrawal_no_lines', 422, 'Agregá al menos una variedad con sus gramos'],
  ['stock.withdrawal_grams_not_positive', 422, 'Los gramos tienen que ser más que cero'],
  ['stock.withdrawal_grams_too_precise', 422, 'Los gramos admiten hasta dos decimales'],
  ['stock.withdrawal_note_too_long', 422, 'La nota admite hasta 200 caracteres'],
  ['stock.withdrawal_variety_not_found', 404, 'Alguna variedad ya no está: elegí otra'],
  ['variety.archived', 404, 'Alguna variedad ya no está: elegí otra'],
] as const

test('every withdrawal refusal the contract lists is covered here, but its gone form', () => {
  const listed = Object.keys(contract.refusalCodes).filter(
    (code) =>
      (code.startsWith('stock.withdrawal_') && code !== 'stock.withdrawal_not_found') ||
      code === 'variety.archived',
  )

  expect(WITHDRAWAL_REFUSALS.map(([code]) => code).sort()).toEqual(listed.sort())
})

test.each(WITHDRAWAL_REFUSALS)('%s shows its fixed text inline, naming nothing typed', async (code, status, text) => {
  renderWithdrawals([WITHDRAWAL_NEW], async (url, init) => {
    if (url === '/stock/withdrawals' && init?.method === 'POST') return jsonResponse(status, { code })
    return jsonResponse(404, {})
  })
  await userEvent.click(await screen.findByRole('button', { name: 'Promoción' }))
  await userEvent.selectOptions(screen.getByLabelText('Variedad 1'), 'Gelato')
  await userEvent.type(screen.getByLabelText('Gramos 1'), '2,5')
  await userEvent.type(screen.getByLabelText('Nota'), 'secreta')

  await userEvent.click(screen.getByRole('button', { name: 'Guardá el retiro' }))

  const alert = await screen.findByRole('alert')
  expect(alert).toHaveTextContent(text)
  expect(alert).not.toHaveTextContent('2,5')
  expect(alert).not.toHaveTextContent('secreta')
  expect(screen.getByLabelText('Gramos 1')).toHaveValue('2,5')
})

test('grams the front cannot read are refused inline without calling the API', async () => {
  const writes = vi.fn()
  renderWithdrawals([WITHDRAWAL_NEW], async (_url, init) => {
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
  expect(router.state.location.pathname).toBe(VARIETIES_PATH)
})

test('with two lines the form keeps the icon and text rule: Quitar is icon-only, Agregar carries its icon and word', async () => {
  await openFromVariedades()
  await userEvent.click(screen.getByRole('button', { name: 'Agregar otra variedad' }))
  await screen.findByLabelText('Variedad 2')

  const quitar = screen.getByRole('button', { name: 'Quitar variedad 1' })
  expect(quitar).toHaveClass('boton-icono')
  expect(quitar).toHaveTextContent('')
  expect(quitar.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  expect(screen.getByRole('button', { name: 'Quitar variedad 2' })).toHaveClass('boton-icono')

  const agregar = screen.getByRole('button', { name: 'Agregar otra variedad' })
  expect(agregar.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  expectIconAndTextRule(screen.getByRole('main'), { limits: LIMITS, optionClasses: ['pildora'] })

  await userEvent.click(quitar)
  expect(screen.queryByLabelText('Variedad 2')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /^Quitar variedad/ })).not.toBeInTheDocument()
})
