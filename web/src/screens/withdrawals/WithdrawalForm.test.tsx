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
import { REASONS, jsonResponse, renderWithdrawals } from './renderWithdrawals'
import { LIMITS } from '../../copy/limits'
import { expectIconAndTextRule } from '../../test/iconAndTextRule'

afterEach(() => {
  vi.unstubAllGlobals()
})

async function openFromVariedades() {
  const view = renderWithdrawals([VARIETIES_PATH], async () => jsonResponse(404, {}))
  await userEvent.click(await screen.findByRole('link', { name: 'Take from stock' }))
  await screen.findByLabelText('Variety 1')
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
  await userEvent.selectOptions(screen.getByLabelText('Variety 1'), 'Zkittlez')
  await userEvent.type(screen.getByLabelText('Grams 1'), '5')

  const promotion = screen.getByRole('button', { name: 'Marketing' })
  const ownUse = screen.getByRole('button', { name: 'Own use' })
  expect(promotion).toHaveAttribute('aria-pressed', 'false')
  expect(ownUse).toHaveAttribute('aria-pressed', 'false')
  expect(screen.getByRole('button', { name: 'Save the withdrawal' })).toBeDisabled()

  await userEvent.click(ownUse)
  expect(ownUse).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: 'Save the withdrawal' })).toBeEnabled()
})

test('offers the business\'s reasons in the order received, none chosen, and Reason is required', async () => {
  const inOrder = [
    { id: 7, name: 'Samples' },
    { id: 3, name: 'Marketing' },
    { id: 9, name: 'Own use' },
  ]
  renderWithdrawals([WITHDRAWAL_NEW], async () => jsonResponse(404, {}), undefined, undefined, async () =>
    jsonResponse(200, inOrder),
  )
  await screen.findByLabelText('Variety 1')

  const reason = screen.getByRole('group', { name: 'Reason' })
  const buttons = within(reason).getAllByRole('button')
  expect(buttons.map((button) => button.textContent)).toEqual(['Samples', 'Marketing', 'Own use'])
  for (const button of buttons) expect(button).toHaveAttribute('aria-pressed', 'false')
  expect(screen.queryByText(/Promotion/)).not.toBeInTheDocument()

  // Everything else filled in: only the missing reason keeps saving off.
  await userEvent.selectOptions(screen.getByLabelText('Variety 1'), 'Zkittlez')
  await userEvent.type(screen.getByLabelText('Grams 1'), '5')
  expect(screen.getByRole('button', { name: 'Save the withdrawal' })).toBeDisabled()
  await userEvent.click(within(reason).getByRole('button', { name: 'Samples' }))
  expect(screen.getByRole('button', { name: 'Save the withdrawal' })).toBeEnabled()
})

test('recording sends the chosen reason by its id', async () => {
  const bodies: unknown[] = []
  renderWithdrawals(
    [WITHDRAWAL_NEW],
    async (url, init) => {
      if (url === '/stock/withdrawals' && init?.method === 'POST') {
        bodies.push(JSON.parse(String(init.body)))
        return jsonResponse(201, WITHDRAWAL)
      }
      return jsonResponse(404, {})
    },
    undefined,
    undefined,
    async () => jsonResponse(200, [{ id: 7, name: 'Samples' }, { id: 3, name: 'Marketing' }]),
  )
  await userEvent.click(await screen.findByRole('button', { name: 'Samples' }))
  await userEvent.selectOptions(screen.getByLabelText('Variety 1'), 'Gelato')
  await userEvent.type(screen.getByLabelText('Grams 1'), '2')

  await userEvent.click(screen.getByRole('button', { name: 'Save the withdrawal' }))

  await waitFor(() => expect(bodies).toHaveLength(1))
  expect(bodies[0]).toEqual({ reason_id: 7, date: '2026-10-06', lines: [{ product_id: 2, quantity: '2' }] })
})

test('editing starts on its own reason and lets any reason of the list be picked', async () => {
  const bodies: unknown[] = []
  renderWithdrawals(['/withdrawals/1/edit'], async (url, init) => {
    if (url === '/stock/withdrawals/1' && init?.method === 'PUT') {
      bodies.push(JSON.parse(String(init.body)))
      return jsonResponse(200, WITHDRAWAL)
    }
    if (url === '/stock/withdrawals/1') return jsonResponse(200, { ...WITHDRAWAL, reason_id: 2, reason_name: 'Own use' })
    return jsonResponse(404, {})
  })

  const own = await screen.findByRole('button', { name: 'Own use' })
  expect(own).toHaveAttribute('aria-pressed', 'true')
  expect(await screen.findByRole('button', { name: 'Marketing' })).toHaveAttribute('aria-pressed', 'false')

  await userEvent.click(screen.getByRole('button', { name: 'Marketing' }))
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))
  await userEvent.click(
    within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Yes, save' }),
  )

  await waitFor(() => expect(bodies).toHaveLength(1))
  expect(bodies[0]).toMatchObject({ reason_id: 1 })
})

test.each([
  ['recording', [WITHDRAWAL_NEW], 'POST', '/stock/withdrawals'],
  ['editing', ['/withdrawals/1/edit'], 'PUT', '/stock/withdrawals/1'],
] as const)(
  'a reason gone while %s keeps the form open and typed, re-reads the list, clears Reason and says so on it',
  async (_mode, path, method, writeUrl) => {
    let reasons = REASONS
    let reasonReads = 0
    renderWithdrawals(
      [...path],
      async (url, init) => {
        if (url === writeUrl && init?.method === method) {
          reasons = [{ id: 1, name: 'Marketing' }]
          return jsonResponse(404, { code: 'stock.withdrawal_reason_not_found' })
        }
        if (url === '/stock/withdrawals/1') return jsonResponse(200, { ...WITHDRAWAL, reason_id: 2, reason_name: 'Own use' })
        return jsonResponse(404, {})
      },
      undefined,
      undefined,
      async () => {
        reasonReads += 1
        return jsonResponse(200, reasons)
      },
    )
    if (method === 'POST') {
      await userEvent.click(await screen.findByRole('button', { name: 'Own use' }))
      await userEvent.selectOptions(screen.getByLabelText('Variety 1'), 'Gelato')
      await userEvent.type(screen.getByLabelText('Grams 1'), '2,5')
    } else {
      await screen.findByRole('button', { name: 'Own use' })
      await userEvent.clear(screen.getByLabelText('Grams 1'))
      await userEvent.type(screen.getByLabelText('Grams 1'), '2,5')
    }
    await userEvent.type(screen.getByLabelText('Note'), 'mía')
    const readsBefore = reasonReads

    await userEvent.click(screen.getByRole('button', { name: method === 'POST' ? 'Save the withdrawal' : 'Save' }))
    if (method === 'PUT') {
      await userEvent.click(
        within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Yes, save' }),
      )
    }

    const reason = screen.getByRole('group', { name: 'Reason' })
    expect(await within(reason).findByRole('alert')).toHaveTextContent('That reason is gone. Pick another.')
    await waitFor(() => expect(reasonReads).toBeGreaterThan(readsBefore))
    await waitFor(() => expect(within(reason).queryByRole('button', { name: 'Own use' })).not.toBeInTheDocument())
    for (const button of within(reason).getAllByRole('button')) expect(button).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByLabelText('Grams 1')).toHaveValue('2,5')
    expect(screen.getByLabelText('Note')).toHaveValue(method === 'POST' ? 'mía' : 'Para la fiestamía')
    expect(screen.getByRole('button', { name: method === 'POST' ? 'Save the withdrawal' : 'Save' })).toBeDisabled()

    await userEvent.click(within(reason).getByRole('button', { name: 'Marketing' }))
    expect(within(reason).queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: method === 'POST' ? 'Save the withdrawal' : 'Save' })).toBeEnabled()
  },
)

test('grams ask for the decimal keypad and the date never goes past today', async () => {
  await openFromVariedades()

  expect(screen.getByLabelText('Grams 1')).toHaveAttribute('inputmode', 'decimal')
  expect(screen.getByLabelText('Date')).toHaveValue('2026-10-06')
  expect(screen.getByLabelText('Date')).toHaveAttribute('max', '2026-10-06')
})

test('?variety= chooses the first line\'s variety', async () => {
  renderWithdrawals([withdrawalNewFor(2)], async () => jsonResponse(404, {}))

  expect(await screen.findByLabelText('Variety 1')).toHaveValue('2')
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
  await userEvent.click(await screen.findByRole('button', { name: 'Marketing' }))
  await userEvent.selectOptions(screen.getByLabelText('Variety 1'), 'Zkittlez')
  await userEvent.type(screen.getByLabelText('Grams 1'), '5,5')
  await userEvent.click(screen.getByRole('button', { name: 'Add another variety' }))
  await userEvent.selectOptions(screen.getByLabelText('Variety 2'), 'Zkittlez')
  await userEvent.type(screen.getByLabelText('Grams 2'), '1')
  await userEvent.type(screen.getByLabelText('Note'), '  Para la fiesta ')

  await userEvent.click(screen.getByRole('button', { name: 'Save the withdrawal' }))

  expect(await screen.findByText('Withdrawal saved')).toBeInTheDocument()
  expect(router.state.location.pathname).toBe(VARIETIES_PATH)
  expect(requests).toEqual([
    {
      url: '/stock/withdrawals',
      method: 'POST',
      body: {
        reason_id: 1,
        date: '2026-10-06',
        lines: [
          { product_id: 1, quantity: '5.5' },
          { product_id: 1, quantity: '1' },
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
  await userEvent.click(await screen.findByRole('button', { name: 'Own use' }))
  await userEvent.selectOptions(screen.getByLabelText('Variety 1'), 'Gelato')
  await userEvent.type(screen.getByLabelText('Grams 1'), '2,5')
  await userEvent.type(screen.getByLabelText('Note'), 'mía')

  await userEvent.click(screen.getByRole('button', { name: 'Save the withdrawal' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Grams allow up to two decimals')
  expect(screen.getByRole('button', { name: 'Own use' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByLabelText('Variety 1')).toHaveValue('2')
  expect(screen.getByLabelText('Grams 1')).toHaveValue('2,5')
  expect(screen.getByLabelText('Note')).toHaveValue('mía')
})

const WITHDRAWAL_REFUSALS = [
  ['stock.withdrawal_reason_required', 422, 'Pick a reason.'],
  ['stock.withdrawal_date_in_future', 422, 'The date cannot be in the future'],
  ['stock.withdrawal_no_lines', 422, 'Add at least one variety with its grams'],
  ['stock.withdrawal_grams_not_positive', 422, 'Grams have to be more than zero'],
  ['stock.withdrawal_grams_too_precise', 422, 'Grams allow up to two decimals'],
  ['stock.withdrawal_note_too_long', 422, 'The note allows up to 200 characters'],
  ['stock.withdrawal_variety_not_found', 404, 'A variety is gone: pick another'],
  ['stock.withdrawal_reason_not_found', 404, 'That reason is gone. Pick another.'],
] as const

test('every withdrawal refusal the contract lists is covered here, but its gone form', () => {
  // The reasons list's own refusals (`stock.withdrawal_reason_name_*`, `_cannot_move`) belong
  // to the settings screen, not to this form.
  const listed = Object.keys(contract.refusalCodes).filter(
    (code) =>
      code.startsWith('stock.withdrawal_') &&
      code !== 'stock.withdrawal_not_found' &&
      (!code.startsWith('stock.withdrawal_reason_') || code === 'stock.withdrawal_reason_required' ||
          code === 'stock.withdrawal_reason_not_found'),
  )

  expect(WITHDRAWAL_REFUSALS.map(([code]) => code).sort()).toEqual(listed.sort())
})

test.each(WITHDRAWAL_REFUSALS)('%s shows its fixed text inline, naming nothing typed', async (code, status, text) => {
  renderWithdrawals([WITHDRAWAL_NEW], async (url, init) => {
    if (url === '/stock/withdrawals' && init?.method === 'POST') return jsonResponse(status, { code })
    return jsonResponse(404, {})
  })
  await userEvent.click(await screen.findByRole('button', { name: 'Marketing' }))
  await userEvent.selectOptions(screen.getByLabelText('Variety 1'), 'Gelato')
  await userEvent.type(screen.getByLabelText('Grams 1'), '2,5')
  await userEvent.type(screen.getByLabelText('Note'), 'secreta')

  await userEvent.click(screen.getByRole('button', { name: 'Save the withdrawal' }))

  const alert = await screen.findByRole('alert')
  expect(alert).toHaveTextContent(text)
  expect(alert).not.toHaveTextContent('2,5')
  expect(alert).not.toHaveTextContent('secreta')
  expect(screen.getByLabelText('Grams 1')).toHaveValue('2,5')
})

test('grams the front cannot read are refused inline without calling the API', async () => {
  const writes = vi.fn()
  renderWithdrawals([WITHDRAWAL_NEW], async (_url, init) => {
    if (init?.method === 'POST') writes()
    return jsonResponse(404, {})
  })
  await userEvent.click(await screen.findByRole('button', { name: 'Marketing' }))
  await userEvent.selectOptions(screen.getByLabelText('Variety 1'), 'Zkittlez')
  await userEvent.type(screen.getByLabelText('Grams 1'), '0')

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
  await screen.findByLabelText('Variety 2')

  const quitar = screen.getByRole('button', { name: 'Remove variety 1' })
  expect(quitar).toHaveClass('boton-icono')
  expect(quitar).toHaveTextContent('')
  expect(quitar.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  expect(screen.getByRole('button', { name: 'Remove variety 2' })).toHaveClass('boton-icono')

  const agregar = screen.getByRole('button', { name: 'Add another variety' })
  expect(agregar.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  expectIconAndTextRule(screen.getByRole('main'), { limits: LIMITS, optionClasses: ['pildora'] })

  await userEvent.click(quitar)
  expect(screen.queryByLabelText('Variety 2')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /^Remove variety/ })).not.toBeInTheDocument()
})
