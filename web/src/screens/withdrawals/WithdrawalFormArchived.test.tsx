/**
 * The withdrawal form and a variety that is archived (`stock.md`, "Sacar del stock"): a
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
import { VARIETIES as VARIETIES_PATH, WITHDRAWAL_NEW, withdrawalNewFor } from '../../routes'
import WithdrawalForm from './WithdrawalForm'
import { ME, jsonResponse, renderWithdrawals } from './renderWithdrawals'

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

const GONE = 'Eso ya no está.'
const GENERIC = 'Revisá los datos e intentá de nuevo.'

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
  const fieldset = screen.getByLabelText(`Variedad ${position}`).closest('fieldset')
  if (fieldset === null) throw new Error('a line is a fieldset')
  return fieldset
}

function variety(position: number): HTMLSelectElement {
  return screen.getByLabelText(`Variedad ${position}`) as HTMLSelectElement
}

const SUBMIT_NEW = 'Guardá el retiro'

/** A new withdrawal with the given varieties on its lines, ready to save. */
async function fillNew(names: string[]) {
  await userEvent.click(await screen.findByRole('button', { name: 'Promoción' }))
  for (const [index, name] of names.entries()) {
    if (index > 0) await userEvent.click(screen.getByRole('button', { name: 'Agregar otra variedad' }))
    await userEvent.selectOptions(await screen.findByLabelText(`Variedad ${index + 1}`), name)
    await userEvent.type(screen.getByLabelText(`Gramos ${index + 1}`), '2')
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
])('/withdrawals/new?variety=<%s id> opens with no variety chosen and nothing dirty', async (_kind, id) => {
  const state = world([GELATO])
  const { router } = render_([withdrawalNewFor(id)], state)

  expect(await screen.findByLabelText('Variedad 1')).toHaveValue('')
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: SUBMIT_NEW })).toBeDisabled()

  // nothing dirty: closing asks nothing
  await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
  await waitFor(() => expect(router.state.location.pathname).toBe(VARIETIES_PATH))
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  expect(state.writes).toEqual([])
})

test('editing a line on a variety archived since keeps its id and name, also while the list is pending', async () => {
  const state = world([GELATO])
  state.listGate = gate()
  const { router } = render_(['/withdrawals/1/edit'], state)

  const select = await screen.findByLabelText('Variedad 1')
  expect(select).toHaveValue('1')
  expect(select).toHaveDisplayValue('Zkittlez')
  expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled()

  await act(async () => {
    state.listGate?.release()
  })
  await waitFor(() => expect(screen.getByRole('button', { name: 'Guardar' })).toBeEnabled())
  expect(variety(1)).toHaveValue('1')
  expect(variety(1)).toHaveDisplayValue('Zkittlez')
  // the picker beside it still offers the unarchived ones
  expect(within(variety(1)).getByRole('option', { name: 'Gelato' })).toBeEnabled()

  await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
  await userEvent.click(
    within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Sí, guardar' }),
  )

  await waitFor(() => expect(router.state.location.pathname).toBe('/withdrawals/1'))
  expect(state.writes).toEqual([
    {
      method: 'PUT',
      body: {
        reason: 'promotion',
        date: '2026-10-02',
        lines: [{ variety_id: 1, grams: '5.5' }],
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
  expect(variety(1)).toHaveValue('1')
  expect(variety(1)).toHaveDisplayValue('Zkittlez')
  expect(screen.getByLabelText('Gramos 1')).toHaveValue('2')
  expect(screen.getByRole('button', { name: SUBMIT_NEW })).toBeDisabled()
  expect(router.state.location.pathname).toBe(WITHDRAWAL_NEW)
  expect(screen.queryByText('Eso ya no está. La lista ya está al día.')).not.toBeInTheDocument()
  // the list was fetched again to learn who is gone
  expect(fetchMock.mock.calls.filter(([url]) => url === '/varieties').length).toBeGreaterThanOrEqual(2)
  expect(state.writes).toHaveLength(1)

  // choosing another variety clears the message and frees the save
  await userEvent.selectOptions(variety(1), 'Gelato')
  expect(within(lineOf(1)).queryByText(GONE)).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: SUBMIT_NEW })).toBeEnabled()
  await userEvent.click(screen.getByRole('button', { name: SUBMIT_NEW }))
  await waitFor(() => expect(router.state.location.pathname).toBe(VARIETIES_PATH))
  expect(state.writes.map((write) => write.body)).toEqual([
    { reason: 'promotion', date: '2026-10-06', lines: [{ variety_id: 1, grams: '2' }] },
    { reason: 'promotion', date: '2026-10-06', lines: [{ variety_id: 2, grams: '2' }] },
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
  expect(variety(2)).toHaveValue('2')
  expect(screen.getByRole('button', { name: SUBMIT_NEW })).toBeDisabled()

  await userEvent.click(screen.getByRole('button', { name: 'Quitar variedad 1' }))

  expect(screen.queryByText(GONE)).not.toBeInTheDocument()
  expect(variety(1)).toHaveValue('2')
  expect(screen.getByRole('button', { name: SUBMIT_NEW })).toBeEnabled()
})

test('the list changing twice before the save still leaves the guilty line named', async () => {
  const state = world([ZKITTLEZ, GELATO])
  render_([WITHDRAWAL_NEW], state)
  await fillNew(['Zkittlez'])

  // a partner archives Zkittlez; a focus refetch brings the list without it
  state.listed = [GELATO]
  archiveEvent()
  await waitFor(() => expect(within(variety(1)).getByRole('option', { name: 'Gelato' })).toBeInTheDocument())
  expect(variety(1)).toHaveDisplayValue('Zkittlez')
  state.archiveOnNextWrite = []

  await userEvent.click(screen.getByRole('button', { name: SUBMIT_NEW }))

  expect(await within(lineOf(1)).findByText(GONE)).toBeInTheDocument()
  expect(variety(1)).toHaveValue('1')
  expect(variety(1)).toHaveDisplayValue('Zkittlez')
})

/** An edit of withdrawal 1 (stored line: Zkittlez, archived since) plus two added lines. */
async function editWithTwoAddedLines(state: World) {
  render_(['/withdrawals/1/edit'], state)
  await screen.findByLabelText('Variedad 1')
  await waitFor(() => expect(screen.getByRole('button', { name: 'Guardar' })).toBeEnabled())
  for (const [position, name] of [
    [2, 'Gelato'],
    [3, 'Gorilla'],
  ] as const) {
    await userEvent.click(screen.getByRole('button', { name: 'Agregar otra variedad' }))
    await userEvent.selectOptions(await screen.findByLabelText(`Variedad ${position}`), name)
    await userEvent.type(screen.getByLabelText(`Gramos ${position}`), '1')
  }
}

async function tapSave() {
  await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
}

async function confirmSave() {
  await userEvent.click(
    within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Sí, guardar' }),
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
  expect(variety(1)).toHaveDisplayValue('Zkittlez')
  expect(variety(3)).toHaveDisplayValue('Gorilla')
  expect(state.writes).toHaveLength(1)

  // the list still fails: the tap sends nothing and the marks stay
  await waitFor(() => expect(screen.getByRole('button', { name: 'Guardar' })).toBeEnabled())
  await tapSave()
  await waitFor(() => expect(screen.getByRole('button', { name: 'Guardar' })).toBeEnabled())
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  expect(state.writes).toHaveLength(1)
  expect(within(lineOf(2)).getByText(GONE)).toBeInTheDocument()

  // the list answers: the healthy line is freed, the archived one stays and blocks saving
  state.listFails = false
  await tapSave()
  await waitFor(() => expect(within(lineOf(2)).queryByText(GONE)).not.toBeInTheDocument())
  expect(within(lineOf(3)).getByText(GONE)).toBeInTheDocument()
  expect(variety(3)).toHaveValue('3')
  expect(variety(3)).toHaveDisplayValue('Gorilla')
  expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled()
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
  expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled()
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
  expect(variety(1)).toHaveValue('1')
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
      if (url === '/varieties') return jsonResponse(200, state.listed)
      return serve(state, url, init)
    }),
  )
  const onGone = vi.fn()
  const router = createMemoryRouter([
    {
      element: <Outlet context={ME} />,
      children: [
        {
          path: '/',
          element: (
            <WithdrawalForm
              target="new"
              onDone={vi.fn()}
              onCancel={vi.fn()}
              onDirtyChange={vi.fn()}
              onGone={onGone}
            />
          ),
        },
      ],
    },
  ])
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  await fillNew(['Zkittlez'])
  state.archiveOnNextWrite = [1]

  fireEvent.click(screen.getByRole('button', { name: SUBMIT_NEW }))

  expect(await within(lineOf(1)).findByText(GONE)).toBeInTheDocument()
  expect(onGone).not.toHaveBeenCalled()
})
