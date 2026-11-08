/**
 * The withdrawal form and a variety that is archived (`stock.md`, "Take from stock"): a
 * preselected archived variety, a stored line on a variety archived since, and a variety a
 * partner archives while the form is open. `fetch` is faked at the network with one mutable
 * world per test; the list of varieties changes over time inside it.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Outlet, RouterProvider, createMemoryRouter } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import WITHDRAWAL from '../../api/fixtures/withdrawal.json'
import {
  HOME,
  VARIETIES as VARIETIES_PATH,
  WITHDRAWAL as WITHDRAWAL_PATH,
  WITHDRAWAL_EDIT,
  WITHDRAWAL_NEW,
  pathTo,
  withdrawalNewFor,
} from '../../routes'
import { SheetRouterProvider, SheetStackProvider } from '../../components/useSheetStack'
import WithdrawalForm from './WithdrawalForm'
import { ME, REASONS, jsonResponse, pickReason, pickVariety, renderWithdrawals, varietyField } from './renderWithdrawals'

afterEach(() => {
  vi.unstubAllGlobals()
})

interface Listed {
  id: number
  name: string
  archived: boolean
  current_price: null
}

const ZKITTLEZ: Listed = { id: 1, name: 'Zkittlez', archived: false, current_price: null }
const GELATO: Listed = { id: 2, name: 'Gelato', archived: false, current_price: null }
const GORILLA: Listed = { id: 3, name: 'Gorilla', archived: false, current_price: null }

const GONE = 'That is gone.'
const GENERIC = 'Check the details and try again.'

interface Gate {
  promise: Promise<void>
  release: () => void
}

function gate(): Gate {
  let release: () => void = () => undefined
  const promise = new Promise<void>((resolve) => {
    release = resolve
  })
  return { promise, release }
}

/** What the server holds and has seen; the tests change it between taps. */
interface World {
  listed: Listed[]
  listFails: boolean
  listGate: Gate | null
  /** The next write is refused as `variety.archived`, after archiving these ids. */
  archiveOnNextWrite: number[] | null
  writes: { method: string; body: unknown }[]
}

function world(listed: Listed[]): World {
  return { listed, listFails: false, listGate: null, archiveOnNextWrite: null, writes: [] }
}

function serve(state: World, url: string, init?: RequestInit): Response | null {
  const write = init?.method === 'POST' || init?.method === 'PUT'
  if (write && (url === '/stock/withdrawals' || url === '/stock/withdrawals/1')) {
    state.writes.push({ method: init.method ?? '', body: JSON.parse(String(init.body)) })
    if (state.archiveOnNextWrite !== null) {
      const archived = state.archiveOnNextWrite
      state.archiveOnNextWrite = null
      state.listed = state.listed.filter((variety) => !archived.includes(variety.id))
      return jsonResponse(404, { code: 'variety.archived' })
    }
    return jsonResponse(init.method === 'POST' ? 201 : 200, WITHDRAWAL)
  }
  if (url === '/stock/withdrawals/1') return jsonResponse(200, WITHDRAWAL)
  return jsonResponse(404, {})
}

function render_(entries: string[], state: World) {
  return renderWithdrawals(
    entries,
    async (url, init) => serve(state, url, init) ?? jsonResponse(404, {}),
    async () => {
      if (state.listGate !== null) await state.listGate.promise
      if (state.listFails) throw new TypeError('offline')
      return jsonResponse(200, state.listed)
    },
  )
}

function lineOf(position: number): HTMLElement {
  const fieldset = variety(position).closest('fieldset')
  if (fieldset === null) throw new Error('a line is a fieldset')
  return fieldset
}

/** The line's Variety Selector field: "Variety" alone on one line, "Variety 1", "Variety 2" on several. */
function variety(position: number): HTMLElement {
  return screen.getByRole('button', { name: position === 1 ? /^Variety(?! [2-9])/ : new RegExp(`^Variety ${position}`) })
}

/** The names the open Variety list offers, then closes it. */
async function offered(position: number): Promise<string[]> {
  await userEvent.click(await varietyField(position))
  const list = within(await screen.findByRole('dialog', { name: /^Variety.* options$/ }))
  const names = list.getAllByRole('button').map((button) => button.textContent ?? '')
  await userEvent.click(list.getByRole('button', { name: 'Close' }))
  return names
}

const SUBMIT_NEW = 'Save the withdrawal'

/** A new withdrawal with the given varieties on its lines, ready to save. */
async function fillNew(names: string[]) {
  await pickReason('Marketing')
  for (const [index, name] of names.entries()) {
    if (index > 0) await userEvent.click(screen.getByRole('button', { name: 'Add another variety' }))
    await pickVariety(index + 1, name)
    await userEvent.type(screen.getByLabelText(`Grams ${index + 1}`), '2')
  }
}

function archiveEvent(): void {
  act(() => {
    window.dispatchEvent(new Event('visibilitychange'))
  })
}

test.each([
  ['archived', 1],
  ['unknown', 99],
])('a new withdrawal opened with an %s variety preselected opens with no variety chosen and nothing dirty', async (_kind, id) => {
  const state = world([GELATO])
  const { router } = render_([withdrawalNewFor(id)], state)

  expect(await varietyField(1)).not.toHaveTextContent(/Gelato|Zkittlez/)
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: SUBMIT_NEW })).toBeDisabled()

  // nothing dirty: closing asks nothing
  await userEvent.click(screen.getByRole('button', { name: 'Close' }))
  await waitFor(() => expect(router.state.location.pathname).toBe(VARIETIES_PATH))
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  expect(state.writes).toEqual([])
})

test('editing a line on a variety archived since keeps its id and name, also while the list is pending', async () => {
  const state = world([GELATO])
  state.listGate = gate()
  const { router } = render_([pathTo(WITHDRAWAL_EDIT, { id: 1 })], state)

  // while the list is pending the stored line is kept, the field busy
  expect(await screen.findByRole('button', { name: /^Variety/ })).toHaveAttribute('aria-busy', 'true')
  expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()

  await act(async () => {
    state.listGate?.release()
  })
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled())
  expect(variety(1)).toHaveTextContent('Zkittlez')
  // the stored name shows with the mark and is never offered; the unarchived ones are
  expect(variety(1)).toHaveTextContent('no longer available')
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(await offered(1)).toEqual(expect.arrayContaining(['Gelato']))
  expect(await offered(1)).not.toContain('Zkittlez')

  await userEvent.click(screen.getByRole('button', { name: 'Save' }))
  await userEvent.click(
    within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Yes, save' }),
  )

  await waitFor(() => expect(router.state.location.pathname).toBe(pathTo(WITHDRAWAL_PATH, { id: 1 })))
  expect(state.writes).toEqual([
    {
      method: 'PUT',
      body: {
        reason_id: 1,
        date: '2026-10-02',
        lines: [{ product_id: 1, quantity: '5.5' }],
        note: 'Para la fiesta',
      },
    },
  ])
})

test('a stale save keeps the guilty line\'s variety and name, says it is gone and blocks saving', async () => {
  const state = world([ZKITTLEZ, GELATO])
  const { router, fetchMock } = render_([WITHDRAWAL_NEW], state)
  await fillNew(['Zkittlez'])
  state.archiveOnNextWrite = [1]

  await userEvent.click(screen.getByRole('button', { name: SUBMIT_NEW }))

  expect(await within(lineOf(1)).findByText(GONE)).toBeInTheDocument()
  expect(variety(1)).toHaveTextContent('Zkittlez')
  expect(screen.getByLabelText('Grams 1')).toHaveValue('2')
  expect(screen.getByRole('button', { name: SUBMIT_NEW })).toBeDisabled()
  expect(router.state.location.pathname).toBe(WITHDRAWAL_NEW)
  expect(screen.queryByText('That is gone. The list is up to date.')).not.toBeInTheDocument()
  // the list was fetched again to learn who is gone
  expect(fetchMock.mock.calls.filter(([url]) => url === '/api/products').length).toBeGreaterThanOrEqual(2)
  expect(state.writes).toHaveLength(1)

  // choosing another variety clears the message and frees the save
  await pickVariety(1, 'Gelato')
  expect(within(lineOf(1)).queryByText(GONE)).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: SUBMIT_NEW })).toBeEnabled()
  await userEvent.click(screen.getByRole('button', { name: SUBMIT_NEW }))
  await waitFor(() => expect(router.state.location.pathname).toBe(VARIETIES_PATH))
  expect(state.writes.map((write) => write.body)).toEqual([
    { reason_id: 1, date: '2026-10-06', lines: [{ product_id: 1, quantity: '2' }] },
    { reason_id: 1, date: '2026-10-06', lines: [{ product_id: 2, quantity: '2' }] },
  ])
})

test('removing the guilty line clears its message and frees the save; the healthy line is never marked', async () => {
  const state = world([ZKITTLEZ, GELATO])
  render_([WITHDRAWAL_NEW], state)
  await fillNew(['Zkittlez', 'Gelato'])
  state.archiveOnNextWrite = [1]

  await userEvent.click(screen.getByRole('button', { name: SUBMIT_NEW }))

  expect(await within(lineOf(1)).findByText(GONE)).toBeInTheDocument()
  expect(within(lineOf(2)).queryByText(GONE)).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: SUBMIT_NEW })).toBeDisabled()

  await userEvent.click(screen.getByRole('button', { name: 'Remove variety 1' }))

  expect(screen.queryByText(GONE)).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: SUBMIT_NEW })).toBeEnabled()
})

test('the list changing twice before the save still leaves the guilty line named', async () => {
  const state = world([ZKITTLEZ, GELATO])
  render_([WITHDRAWAL_NEW], state)
  await fillNew(['Zkittlez'])

  // a partner archives Zkittlez; a focus refetch brings the list without it
  state.listed = [GELATO]
  archiveEvent()
  await waitFor(() => expect(variety(1)).toHaveTextContent('no longer available'))
  expect(variety(1)).toHaveTextContent('Zkittlez')
  expect(screen.queryByText(GONE)).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: SUBMIT_NEW })).toBeEnabled()
  state.archiveOnNextWrite = []

  await userEvent.click(screen.getByRole('button', { name: SUBMIT_NEW }))

  expect(await within(lineOf(1)).findByText(GONE)).toBeInTheDocument()
  expect(variety(1)).toHaveTextContent('Zkittlez')
  expect(screen.getByRole('button', { name: SUBMIT_NEW })).toBeDisabled()

  await pickVariety(1, 'Gelato')
  expect(within(lineOf(1)).queryByText(GONE)).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: SUBMIT_NEW })).toBeEnabled()
  await userEvent.click(screen.getByRole('button', { name: SUBMIT_NEW }))
  await waitFor(() => expect(state.writes).toHaveLength(2))
  expect(state.writes[1]?.body).toEqual({
    reason_id: 1,
    date: '2026-10-06',
    lines: [{ product_id: 2, quantity: '2' }],
  })
})

test('a line preselected through ?variety= keeps its name with the mark when a save finds it archived', async () => {
  const state = world([ZKITTLEZ, GELATO])
  render_([withdrawalNewFor(1)], state)
  await varietyField(1)
  await waitFor(() => expect(variety(1)).toHaveTextContent('Zkittlez'))
  await pickReason('Marketing')
  await userEvent.type(screen.getByLabelText('Grams 1'), '2')
  state.archiveOnNextWrite = [1]

  await userEvent.click(screen.getByRole('button', { name: SUBMIT_NEW }))

  expect(await within(lineOf(1)).findByText(GONE)).toBeInTheDocument()
  expect(variety(1)).toHaveTextContent('Zkittlez')
  expect(variety(1)).toHaveTextContent('no longer available')
  expect(screen.getByRole('button', { name: SUBMIT_NEW })).toBeDisabled()
})

/** An edit of withdrawal 1 (stored line: Zkittlez, archived since) plus two added lines. */
async function editWithTwoAddedLines(state: World) {
  render_([pathTo(WITHDRAWAL_EDIT, { id: 1 })], state)
  await varietyField(1)
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled())
  for (const [position, name] of [
    [2, 'Gelato'],
    [3, 'Gorilla'],
  ] as const) {
    await userEvent.click(screen.getByRole('button', { name: 'Add another variety' }))
    await pickVariety(position, name)
    await userEvent.type(screen.getByLabelText(`Grams ${position}`), '1')
  }
}

async function tapSave() {
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))
}

async function confirmSave() {
  await userEvent.click(
    within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Yes, save' }),
  )
}

test('a failed refetch marks only the non-stored lines and a tap re-checks the list instead of sending', async () => {
  const state = world([GELATO, GORILLA])
  await editWithTwoAddedLines(state)
  state.archiveOnNextWrite = [3]
  state.listFails = true

  await tapSave()
  await confirmSave()

  await waitFor(() => expect(within(lineOf(2)).getByText(GONE)).toBeInTheDocument())
  expect(within(lineOf(3)).getByText(GONE)).toBeInTheDocument()
  expect(within(lineOf(1)).queryByText(GONE)).not.toBeInTheDocument()
  expect(variety(1)).toHaveTextContent('Zkittlez')
  expect(variety(3)).toHaveTextContent('Gorilla')
  expect(state.writes).toHaveLength(1)

  // the list still fails: the tap sends nothing and the marks stay
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled())
  await tapSave()
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled())
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  expect(state.writes).toHaveLength(1)
  expect(within(lineOf(2)).getByText(GONE)).toBeInTheDocument()

  // the list answers: the healthy line is freed, the archived one stays and blocks saving
  state.listFails = false
  await tapSave()
  await waitFor(() => expect(within(lineOf(2)).queryByText(GONE)).not.toBeInTheDocument())
  expect(within(lineOf(3)).getByText(GONE)).toBeInTheDocument()
  expect(variety(3)).toHaveTextContent('Gorilla')
  expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  expect(state.writes).toHaveLength(1)
})

test('a focus refetch that succeeds after a failed one frees the healthy line and keeps the archived one', async () => {
  const state = world([GELATO, GORILLA])
  await editWithTwoAddedLines(state)
  state.archiveOnNextWrite = [3]
  state.listFails = true
  await tapSave()
  await confirmSave()
  await waitFor(() => expect(within(lineOf(2)).getByText(GONE)).toBeInTheDocument())

  state.listFails = false
  archiveEvent()

  await waitFor(() => expect(within(lineOf(2)).queryByText(GONE)).not.toBeInTheDocument())
  expect(within(lineOf(3)).getByText(GONE)).toBeInTheDocument()
  expect(within(lineOf(1)).queryByText(GONE)).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  expect(state.writes).toHaveLength(1)
})

test('a suspect line whose list shows nobody guilty is sent on the next tap', async () => {
  const state = world([GELATO, GORILLA])
  await editWithTwoAddedLines(state)
  state.archiveOnNextWrite = []
  state.listFails = true
  await tapSave()
  await confirmSave()
  await waitFor(() => expect(within(lineOf(2)).getByText(GONE)).toBeInTheDocument())

  state.listFails = false
  await tapSave()

  // the list shows both varieties: no line is left marked, so the body goes after the confirmation
  await confirmSave()
  await waitFor(() => expect(state.writes).toHaveLength(2))
})

test('a refetch that still lists every variety shows the generic line and leaves saving on', async () => {
  const state = world([ZKITTLEZ, GELATO])
  render_([WITHDRAWAL_NEW], state)
  await fillNew(['Zkittlez'])
  state.archiveOnNextWrite = []

  await userEvent.click(screen.getByRole('button', { name: SUBMIT_NEW }))

  expect(await screen.findByRole('alert')).toHaveTextContent(GENERIC)
  expect(screen.queryByText(GONE)).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: SUBMIT_NEW })).toBeEnabled()
})

test('saving is off while the refusal\'s refetch is in flight', async () => {
  const state = world([ZKITTLEZ, GELATO])
  render_([WITHDRAWAL_NEW], state)
  await fillNew(['Zkittlez'])
  state.archiveOnNextWrite = [1]
  state.listGate = gate()

  await userEvent.click(screen.getByRole('button', { name: SUBMIT_NEW }))

  await waitFor(() => expect(state.writes).toHaveLength(1))
  expect(screen.getByRole('button', { name: SUBMIT_NEW })).toBeDisabled()
  expect(screen.queryByText(GONE)).not.toBeInTheDocument()

  await act(async () => {
    state.listGate?.release()
  })
  expect(await within(lineOf(1)).findByText(GONE)).toBeInTheDocument()
})

test('the form never calls onGone on variety.archived', async () => {
  const state = world([ZKITTLEZ, GELATO])
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/products') return jsonResponse(200, state.listed)
      if (url === '/api/withdrawal-reasons') return jsonResponse(200, REASONS)
      return serve(state, url, init)
    }),
  )
  const onGone = vi.fn()
  const router = createMemoryRouter([
    {
      element: <Outlet context={ME} />,
      children: [
        {
          path: HOME,
          element: (
            <SheetStackProvider>
              <WithdrawalForm
                target="new"
                onDone={vi.fn()}
                onCancel={vi.fn()}
                onDirtyChange={vi.fn()}
                onGone={onGone}
              />
            </SheetStackProvider>
          ),
        },
      ],
    },
  ])
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <SheetRouterProvider router={router}>
        <RouterProvider router={router} />
      </SheetRouterProvider>
    </QueryClientProvider>,
  )
  await fillNew(['Zkittlez'])
  state.archiveOnNextWrite = [1]

  fireEvent.click(screen.getByRole('button', { name: SUBMIT_NEW }))

  expect(await within(lineOf(1)).findByText(GONE)).toBeInTheDocument()
  expect(onGone).not.toHaveBeenCalled()
})
