/**
 * The withdrawal form screen (route `/withdrawals/new`) through Testing Library, `fetch`
 * faked at the network: its chrome and leave guard, the reason with no default, what a save
 * sends and toasts, and a refusal that keeps what was typed (`stock.md`, "Take from stock").
 */

import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { stubViewport } from '../../test-viewport'
import contract from '../../api/contract.json'
import WITHDRAWAL from '../../api/fixtures/withdrawal.json'
import { VARIETIES as VARIETIES_PATH, WITHDRAWAL as WITHDRAWAL_PATH, WITHDRAWAL_EDIT, WITHDRAWAL_NEW, pathTo, withdrawalNewFor } from '../../routes'
import { REASONS, jsonResponse, pickReason, pickVariety, reasonField, renderWithdrawals, varietyField } from './renderWithdrawals'
import { LIMITS } from '../../copy/limits'
import { expectIconAndTextRule } from '../../test/iconAndTextRule'

afterEach(() => {
  vi.unstubAllGlobals()
})

async function openFromVariedades() {
  const view = renderWithdrawals([VARIETIES_PATH], async () => jsonResponse(404, {}))
  await userEvent.click(await screen.findByRole('link', { name: 'Take from stock' }))
  await varietyField(1)
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
  await pickVariety(1, 'Zkittlez')
  await userEvent.type(screen.getByLabelText('Grams 1'), '5')

  expect(await reasonField()).toHaveAttribute('aria-expanded', 'false')
  expect(screen.getByRole('button', { name: 'Save the withdrawal' })).toBeDisabled()

  await pickReason('Own use')
  expect(await reasonField()).toHaveTextContent('Own use')
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
  await varietyField(1)

  await userEvent.click(await reasonField())
  const list = within(await screen.findByRole('dialog', { name: 'Reason options' }))
  expect(list.getAllByRole('button').map((button) => button.textContent)).toEqual(
    expect.arrayContaining(['Samples', 'Marketing', 'Own use']),
  )
  const names = list.getAllByRole('button').map((button) => button.textContent)
  expect(names.indexOf('Samples')).toBeLessThan(names.indexOf('Marketing'))
  expect(names.indexOf('Marketing')).toBeLessThan(names.indexOf('Own use'))
  expect(screen.queryByText(/Promotion/)).not.toBeInTheDocument()
  await userEvent.click(list.getByRole('button', { name: 'Close' }))

  // Everything else filled in: only the missing reason keeps saving off.
  await pickVariety(1, 'Zkittlez')
  await userEvent.type(screen.getByLabelText('Grams 1'), '5')
  expect(screen.getByRole('button', { name: 'Save the withdrawal' })).toBeDisabled()
  await pickReason('Samples')
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
  await pickReason('Samples')
  await pickVariety(1, 'Gelato')
  await userEvent.type(screen.getByLabelText('Grams 1'), '2')

  await userEvent.click(screen.getByRole('button', { name: 'Save the withdrawal' }))

  await waitFor(() => expect(bodies).toHaveLength(1))
  expect(bodies[0]).toEqual({ reason_id: 7, date: '2026-10-06', lines: [{ product_id: 2, quantity: '2' }] })
})

test('editing starts on its own reason and lets any reason of the list be picked', async () => {
  const bodies: unknown[] = []
  renderWithdrawals([pathTo(WITHDRAWAL_EDIT, { id: 1 })], async (url, init) => {
    if (url === '/stock/withdrawals/1' && init?.method === 'PUT') {
      bodies.push(JSON.parse(String(init.body)))
      return jsonResponse(200, WITHDRAWAL)
    }
    if (url === '/stock/withdrawals/1') return jsonResponse(200, { ...WITHDRAWAL, reason_id: 2, reason_name: 'Own use' })
    return jsonResponse(404, {})
  })

  expect(await reasonField()).toHaveTextContent('Own use')

  await pickReason('Marketing')
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))
  await userEvent.click(
    within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Yes, save' }),
  )

  await waitFor(() => expect(bodies).toHaveLength(1))
  expect(bodies[0]).toMatchObject({ reason_id: 1 })
})

test.each([
  ['recording', [WITHDRAWAL_NEW], 'POST', '/stock/withdrawals'],
  ['editing', [pathTo(WITHDRAWAL_EDIT, { id: 1 })], 'PUT', '/stock/withdrawals/1'],
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
      await pickReason('Own use')
      await pickVariety(1, 'Gelato')
      await userEvent.type(screen.getByLabelText('Grams 1'), '2,5')
    } else {
      expect(await reasonField()).toHaveTextContent('Own use')
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

    const field = await reasonField()
    const reason = field.closest('.campo') as HTMLElement
    expect(await within(reason).findByRole('alert')).toHaveTextContent('That reason is gone. Pick another.')
    await waitFor(() => expect(reasonReads).toBeGreaterThan(readsBefore))
    await waitFor(() => expect(field).not.toHaveTextContent('Own use'))
    expect(await reasonField()).toBe(field)
    expect(screen.getByLabelText('Grams 1')).toHaveValue('2,5')
    expect(screen.getByLabelText('Note')).toHaveValue(method === 'POST' ? 'mía' : 'Para la fiestamía')
    expect(screen.getByRole('button', { name: method === 'POST' ? 'Save the withdrawal' : 'Save' })).toBeDisabled()

    await pickReason('Marketing')
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

  expect(await varietyField(1)).toHaveTextContent('Gelato')
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
  await pickReason('Marketing')
  await pickVariety(1, 'Zkittlez')
  await userEvent.type(screen.getByLabelText('Grams 1'), '5,5')
  await userEvent.click(screen.getByRole('button', { name: 'Add another variety' }))
  await pickVariety(2, 'Zkittlez')
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
  await pickReason('Own use')
  await pickVariety(1, 'Gelato')
  await userEvent.type(screen.getByLabelText('Grams 1'), '2,5')
  await userEvent.type(screen.getByLabelText('Note'), 'mía')

  await userEvent.click(screen.getByRole('button', { name: 'Save the withdrawal' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Grams allow up to two decimals')
  expect(await reasonField()).toHaveTextContent('Own use')
  expect(await varietyField(1)).toHaveTextContent('Gelato')
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
  await pickReason('Marketing')
  await pickVariety(1, 'Gelato')
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
  await pickReason('Marketing')
  await pickVariety(1, 'Zkittlez')
  await userEvent.type(screen.getByLabelText('Grams 1'), '0')

  await userEvent.click(screen.getByRole('button', { name: 'Save the withdrawal' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Check the grams entered')
  expect(writes).not.toHaveBeenCalled()
})

test('a send that finds the withdrawal gone goes to Variedades with the fixed notice', async () => {
  const { router } = renderWithdrawals([pathTo(WITHDRAWAL_EDIT, { id: 1 })], async (url, init) => {
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
  await varietyField(2)
  // An unchosen Selector shows no text yet: choose, so the rule reads what the seller reads.
  await pickReason('Marketing')
  await pickVariety(1, 'Gelato')
  await pickVariety(2, 'Zkittlez')

  const quitar = screen.getByRole('button', { name: 'Remove variety 1' })
  expect(quitar).toHaveClass('boton-icono')
  expect(quitar).toHaveTextContent('')
  expect(quitar.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  expect(screen.getByRole('button', { name: 'Remove variety 2' })).toHaveClass('boton-icono')

  const agregar = screen.getByRole('button', { name: 'Add another variety' })
  expect(agregar.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  expectIconAndTextRule(screen.getByRole('main'), { limits: LIMITS, optionClasses: ['pildora'] })

  await userEvent.click(quitar)
  expect(screen.queryByRole('button', { name: /^Variety 2/ })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /^Remove variety/ })).not.toBeInTheDocument()
})

const MANY_VARIETIES = Array.from({ length: 12 }, (_unused, index) => ({
  id: 100 + index,
  name: `Cepa ${String(index + 1).padStart(2, '0')}`,
  current_price: null,
}))
const MANY_REASONS = Array.from({ length: 12 }, (_unused, index) => ({
  id: 200 + index,
  name: `Motivo ${String(index + 1).padStart(2, '0')}`,
}))

function renderMany(entries: string[], rest: Parameters<typeof renderWithdrawals>[1] = async () => jsonResponse(404, {})) {
  return renderWithdrawals(
    entries,
    rest,
    async () => jsonResponse(200, MANY_VARIETIES),
    undefined,
    async () => jsonResponse(200, MANY_REASONS),
  )
}

test('with 12 Varieties and 12 reasons both fields are Selectors, found by typing, with no select, pressed button or radio group', async () => {
  renderMany([WITHDRAWAL_NEW])
  const reason = await reasonField()
  await varietyField(1)

  expect(document.querySelector('select')).toBeNull()
  expect(screen.queryByRole('radiogroup')).toBeNull()
  expect(screen.getAllByRole('button').filter((button) => button.hasAttribute('aria-pressed'))).toEqual([])

  await userEvent.click(reason)
  const reasons = within(await screen.findByRole('dialog', { name: 'Reason options' }))
  await userEvent.type(reasons.getByRole('searchbox'), '09')
  expect(reasons.queryByRole('button', { name: 'Motivo 08' })).toBeNull()
  await userEvent.click(reasons.getByRole('button', { name: 'Motivo 09' }))
  expect(reason).toHaveTextContent('Motivo 09')

  await userEvent.click(await varietyField(1))
  const varieties = within(await screen.findByRole('dialog', { name: 'Variety options' }))
  await userEvent.type(varieties.getByRole('searchbox'), '07')
  await userEvent.click(varieties.getByRole('button', { name: 'Cepa 07' }))
  expect(await varietyField(1)).toHaveTextContent('Cepa 07')
})

test.each([
  ['reasons', /^Reason/],
  ['Varieties', /^Variety/],
] as const)('while the %s load the field is busy with no empty wording, and an untouched edit is clean', async (which, name) => {
  let release: (response: Response) => void = () => undefined
  const pending = () => new Promise<Response>((resolve) => (release = resolve))
  renderWithdrawals(
    [pathTo(WITHDRAWAL_EDIT, { id: 1 })],
    async (url) => (url === '/stock/withdrawals/1' ? jsonResponse(200, WITHDRAWAL) : jsonResponse(404, {})),
    which === 'Varieties' ? pending : undefined,
    undefined,
    which === 'reasons' ? pending : undefined,
  )

  expect(await screen.findByRole('button', { name })).toHaveAttribute('aria-busy', 'true')
  expect(screen.queryByText(/No reasons yet|No varieties yet/)).toBeNull()
  await userEvent.click(screen.getByRole('button', { name: 'Close' }))
  expect(screen.queryByRole('alertdialog')).toBeNull()
  release(jsonResponse(200, []))
})

test.each([
  ['reasons', 'No reasons yet. Add them in Settings → Business → Withdrawal reasons.'],
  ['Varieties', 'No varieties yet. Add them in the Varieties tab.'],
] as const)('an empty successful load of the %s names the place where they are made', async (which, wording) => {
  renderWithdrawals(
    [WITHDRAWAL_NEW],
    async () => jsonResponse(404, {}),
    async () => jsonResponse(200, which === 'Varieties' ? [] : [{ id: 1, name: 'Zkittlez', current_price: null }]),
    undefined,
    async () => jsonResponse(200, which === 'reasons' ? [] : REASONS),
  )
  await userEvent.click(which === 'reasons' ? await reasonField() : await varietyField(1))
  expect(await screen.findByText(wording)).toBeInTheDocument()
})

test('editing while the reasons load keeps the stored reason, and shows it once they arrive', async () => {
  let release: (response: Response) => void = () => undefined
  renderWithdrawals(
    [pathTo(WITHDRAWAL_EDIT, { id: 1 })],
    async (url) => (url === '/stock/withdrawals/1' ? jsonResponse(200, WITHDRAWAL) : jsonResponse(404, {})),
    undefined,
    undefined,
    () => new Promise<Response>((resolve) => (release = resolve)),
  )

  expect(await screen.findByRole('button', { name: /^Reason/ })).toHaveAttribute('aria-busy', 'true')
  release(jsonResponse(200, REASONS))
  expect(await reasonField()).toHaveTextContent('Marketing')
})

test('a focus refetch with the list open keeps it open with its search text', async () => {
  renderMany([WITHDRAWAL_NEW])
  await userEvent.click(await varietyField(1))
  const list = within(await screen.findByRole('dialog', { name: 'Variety options' }))
  await userEvent.type(list.getByRole('searchbox'), '07')

  act(() => {
    window.dispatchEvent(new Event('visibilitychange'))
  })
  await new Promise((resolve) => setTimeout(resolve, 50))

  expect(screen.getByRole('dialog', { name: 'Variety options' })).toBeInTheDocument()
  expect(list.getByRole('searchbox')).toHaveValue('07')
})

const EDIT_PATH = pathTo(WITHDRAWAL_EDIT, { id: 1 })
const DETAIL_PATH = pathTo(WITHDRAWAL_PATH, { id: 1 })

describe.each([
  ['new', [VARIETIES_PATH, WITHDRAWAL_NEW], VARIETIES_PATH, WITHDRAWAL_NEW],
  ['edit', [VARIETIES_PATH, DETAIL_PATH, EDIT_PATH], DETAIL_PATH, EDIT_PATH],
] as const)('WithdrawalFormRoute %s in the real router', (mode, entries, parent, here) => {
  const served = async (url: string) =>
    url === '/stock/withdrawals/1' ? jsonResponse(200, WITHDRAWAL) : jsonResponse(404, {})

  async function back(router: { navigate: (delta: number) => Promise<void> }) {
    await act(async () => {
      await router.navigate(-1)
    })
  }

  test('a clean form: back goes to the parent with no question', async () => {
    const { router } = renderMany([...entries], served)
    await reasonField()
    await back(router)
    await waitFor(() => expect(router.state.location.pathname).toBe(parent))
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  test('a dirty form: back raises LeaveConfirm', async () => {
    const { router } = renderMany([...entries], served)
    await userEvent.type(await screen.findByLabelText('Note'), '!')
    await back(router)
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(here)
  })

  test('with the list open back closes only the list and keeps what was typed; a second back asks', async () => {
    const { router } = renderMany([...entries], served)
    await userEvent.type(await screen.findByLabelText('Note'), '!')
    await userEvent.click(await reasonField())
    expect(await screen.findByRole('dialog', { name: 'Reason options' })).toBeInTheDocument()
    expect(router.state.location.state).toMatchObject({ sheet: 1 })

    await back(router)
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Reason options' })).toBeNull())
    expect(router.state.location.pathname).toBe(here)
    expect(screen.getByLabelText('Note')).toHaveValue(mode === 'new' ? '!' : 'Para la fiesta!')
    expect(screen.queryByRole('alertdialog')).toBeNull()

    await back(router)
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument()
  })

  test('on the computer Escape with the dropdown open closes only the dropdown', async () => {
    stubViewport('computer')
    const { router } = renderMany([...entries], served)
    await userEvent.click(await reasonField())
    expect(await screen.findByRole('listbox', { name: 'Reason options' })).toBeInTheDocument()

    await userEvent.keyboard('{Escape}')

    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull())
    expect(router.state.location.pathname).toBe(here)
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(screen.getByLabelText('Note')).toBeInTheDocument()
  })
})
