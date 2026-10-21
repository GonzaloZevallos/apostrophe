/**
 * The withdrawal form screen (route `/withdrawals/new`) through Testing Library, `fetch`
 * faked at the network: its chrome and leave guard, the reason with no default, what a save
 * sends and toasts, and a refusal that keeps what was typed (`stock.md`, "Take from stock").
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
  await userEvent.click(await screen.findByRole('link', { name: 'Take from stock' }))
  await screen.findByLabelText('Variedad 1')
  return view
}

test('is a form: Cerrar, no bar and no "+ New sale"', async () => {
  await openFromVariedades()

  expect(screen.getByText('Take from stock')).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: /New sale/ })).not.toBeInTheDocument()
  // the side rail is CSS-hidden on a phone; the bottom bar is what a form drops
  expect(document.querySelector('.bar-inferior')).toBeNull()
})

test('closing it untouched leaves without asking', async () => {
  const { router } = await openFromVariedades()

  await userEvent.click(screen.getByRole('button', { name: 'Close' }))

  await waitFor(() => expect(router.state.location.pathname).toBe(VARIETIES_PATH))
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
})

test('closing it with something typed asks first, and discarding leaves', async () => {
  const { router } = await openFromVariedades()
  await userEvent.type(screen.getByLabelText('Note'), 'Para la fiesta')

  await userEvent.click(screen.getByRole('button', { name: 'Close' }))

  const dialog = await screen.findByRole('alertdialog', { name: 'Discard the withdrawal?' })
  await userEvent.click(within(dialog).getByRole('button', { name: 'No, keep entering' }))
  expect(router.state.location.pathname).toBe(WITHDRAWAL_NEW)
  expect(screen.getByLabelText('Note')).toHaveValue('Para la fiesta')

  await userEvent.click(screen.getByRole('button', { name: 'Close' }))
  await userEvent.click(
    within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Yes, discard it' }),
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
  expect(screen.getByRole('button', { name: 'Save the withdrawal' })).toBeDisabled()

  await userEvent.click(ownUse)
  expect(ownUse).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: 'Save the withdrawal' })).toBeEnabled()
})

test('grams ask for the decimal keypad and the date never goes past today', async () => {
  await openFromVariedades()

  expect(screen.getByLabelText('Gramos 1')).toHaveAttribute('inputmode', 'decimal')
  expect(screen.getByLabelText('Date')).toHaveValue('2026-10-06')
  expect(screen.getByLabelText('Date')).toHaveAttribute('max', '2026-10-06')
})

test('?variety= chooses the first line\'s variety', async () => {
  renderWithdrawals([withdrawalNewFor(2)], async () => jsonResponse(404, {}))

  expect(await screen.findByLabelText('Variedad 1')).toHaveValue('2')
  // chosen from the link, so nothing is typed yet: leaving asks nothing
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
})

test('saves with every line, a trimmed note, then shows "Withdrawal saved" where it goes back', async () => {
  const requests: { url: string; method: string | undefined; body: unknown }[] = []
  const { router } = renderWithdrawals([VARIETIES_PATH], async (url, init) => {
    if (url === '/stock/withdrawals' && init?.method === 'POST') {
      requests.push({ url, method: init.method, body: JSON.parse(String(init.body)) })
      return jsonResponse(201, WITHDRAWAL)
    }
    return jsonResponse(404, {})
  })
  await userEvent.click(await screen.findByRole('link', { name: 'Take from stock' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Promoción' }))
  await userEvent.selectOptions(screen.getByLabelText('Variedad 1'), 'Zkittlez')
  await userEvent.type(screen.getByLabelText('Gramos 1'), '5,5')
  await userEvent.click(screen.getByRole('button', { name: 'Add another variety' }))
  await userEvent.selectOptions(screen.getByLabelText('Variedad 2'), 'Zkittlez')
  await userEvent.type(screen.getByLabelText('Gramos 2'), '1')
  await userEvent.type(screen.getByLabelText('Note'), '  Para la fiesta ')

  await userEvent.click(screen.getByRole('button', { name: 'Save the withdrawal' }))

  expect(await screen.findByText('Withdrawal saved')).toBeInTheDocument()
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
  await userEvent.click(await screen.findByRole('link', { name: 'Take from stock' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Consumo propio' }))
  await userEvent.selectOptions(screen.getByLabelText('Variedad 1'), 'Gelato')
  await userEvent.type(screen.getByLabelText('Gramos 1'), '2,5')
  await userEvent.type(screen.getByLabelText('Note'), 'mía')

  await userEvent.click(screen.getByRole('button', { name: 'Save the withdrawal' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Grams allow up to two decimals')
  expect(screen.getByRole('button', { name: 'Consumo propio' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByLabelText('Variedad 1')).toHaveValue('2')
  expect(screen.getByLabelText('Gramos 1')).toHaveValue('2,5')
  expect(screen.getByLabelText('Note')).toHaveValue('mía')
})

const WITHDRAWAL_REFUSALS = [
  ['stock.withdrawal_reason_required', 422, 'Pick the reason: Promotion or Own use'],
  ['stock.withdrawal_date_in_future', 422, 'The date cannot be in the future'],
  ['stock.withdrawal_no_lines', 422, 'Add at least one variety with its grams'],
  ['stock.withdrawal_grams_not_positive', 422, 'Grams have to be more than zero'],
  ['stock.withdrawal_grams_too_precise', 422, 'Grams allow up to two decimals'],
  ['stock.withdrawal_note_too_long', 422, 'The note allows up to 200 characters'],
  ['stock.withdrawal_variety_not_found', 404, 'A variety is gone: pick another'],
] as const

test('every withdrawal refusal the contract lists is covered here, but its gone form', () => {
  const listed = Object.keys(contract.refusalCodes).filter(
    (code) => code.startsWith('stock.withdrawal_') && code !== 'stock.withdrawal_not_found',
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
  await userEvent.type(screen.getByLabelText('Note'), 'secreta')

  await userEvent.click(screen.getByRole('button', { name: 'Save the withdrawal' }))

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

  await userEvent.click(screen.getByRole('button', { name: 'Save the withdrawal' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Check the grams entered')
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
  await userEvent.type(await screen.findByLabelText('Note'), '!')
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))
  await userEvent.click(
    within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Yes, save' }),
  )

  expect(await screen.findByText('That is gone. The list is up to date.')).toBeInTheDocument()
  expect(router.state.location.pathname).toBe(VARIETIES_PATH)
})

test('with two lines the form keeps the icon and text rule: Quitar is icon-only, Agregar carries its icon and word', async () => {
  await openFromVariedades()
  await userEvent.click(screen.getByRole('button', { name: 'Add another variety' }))
  await screen.findByLabelText('Variedad 2')

  const quitar = screen.getByRole('button', { name: 'Quitar variety 1' })
  expect(quitar).toHaveClass('boton-icono')
  expect(quitar).toHaveTextContent('')
  expect(quitar.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  expect(screen.getByRole('button', { name: 'Quitar variety 2' })).toHaveClass('boton-icono')

  const agregar = screen.getByRole('button', { name: 'Add another variety' })
  expect(agregar.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  expectIconAndTextRule(screen.getByRole('main'), { limits: LIMITS, optionClasses: ['pildora'] })

  await userEvent.click(quitar)
  expect(screen.queryByLabelText('Variedad 2')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /^Quitar variety/ })).not.toBeInTheDocument()
})
