/**
 * `WithdrawalReasons` at the screen seam, with `fetch` faked: the order the API answers, the
 * edge move buttons and their accessible names, each refusal keeping the typed text, both
 * toasts without a name, and both delete refusals.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import { SheetRouterProvider } from '../../components/useSheetStack'
import { SETTINGS_WITHDRAWAL_REASONS } from '../../routes'
import { SETTINGS_TEXT } from '../../copy/settings'
import WithdrawalReasons from './WithdrawalReasons'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function refusal(status: number, code: string): Response {
  return jsonResponse(status, { code, detail: 'x' })
}

const LIST = [
  { id: 1, name: 'Marketing' },
  { id: 2, name: 'Own use' },
]

type Fetch = (url: string, init?: RequestInit) => Promise<Response>

function renderScreen(extra: Fetch, served: typeof LIST = LIST) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/withdrawal-reasons' && (init?.method ?? 'GET') === 'GET') return jsonResponse(200, served)
      return extra(url, init)
    }),
  )
  const router = createMemoryRouter([{ path: SETTINGS_WITHDRAWAL_REASONS, element: <WithdrawalReasons /> }], {
    initialEntries: [SETTINGS_WITHDRAWAL_REASONS],
  })
  render(
    <QueryClientProvider client={new QueryClient()}>
      <SheetRouterProvider router={router}>
        <RouterProvider router={router} />
      </SheetRouterProvider>
    </QueryClientProvider>,
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

test('rows follow the API order; the first has no Up and the last no Down, named by reason', async () => {
  renderScreen(async () => jsonResponse(500, {}))
  await screen.findByText('Marketing')
  expect(screen.queryByRole('button', { name: SETTINGS_TEXT.moveReasonUp('Marketing') })).toBeNull()
  expect(screen.getByRole('button', { name: 'Move Marketing down' })).toBeVisible()
  expect(screen.getByRole('button', { name: 'Move Own use up' })).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Move Own use down' })).toBeNull()
})

test('a move renders the list the API answers; a failed move says so', async () => {
  let fail = false
  const served = [...LIST]
  renderScreen(async (url, init) => {
    if (url === '/api/withdrawal-reasons/1/move' && init?.method === 'POST') {
      if (fail) return refusal(409, 'stock.withdrawal_reason_cannot_move')
      served.reverse()
      return jsonResponse(200, served)
    }
    throw new Error(`unexpected ${url}`)
  }, served)
  await userEvent.click(await screen.findByRole('button', { name: 'Move Marketing down' }))
  expect(await screen.findByRole('button', { name: 'Move Marketing up' })).toBeVisible()
  fail = true
  await userEvent.click(screen.getByRole('button', { name: 'Move Marketing up' }))
  expect(await screen.findByText(SETTINGS_TEXT.reasonMoveFailed)).toBeVisible()
})

test('a move answered 404 refreshes the list and does not say the order failed', async () => {
  const served = [...LIST]
  renderScreen(async (url, init) => {
    if (url === '/api/withdrawal-reasons/1/move' && init?.method === 'POST') {
      served.shift() // Another device deleted "Marketing" meanwhile.
      return refusal(404, 'stock.withdrawal_reason_not_found')
    }
    throw new Error(`unexpected ${url}`)
  }, served)
  await userEvent.click(await screen.findByRole('button', { name: 'Move Marketing down' }))
  await waitFor(() => expect(screen.queryByText('Marketing')).toBeNull())
  expect(screen.getByText('Own use')).toBeVisible()
  expect(screen.queryByText(SETTINGS_TEXT.reasonMoveFailed)).toBeNull()
})

test.each([
  ['stock.withdrawal_reason_name_blank', 422, SETTINGS_TEXT.reasonNameBlank],
  ['stock.withdrawal_reason_name_too_long', 422, SETTINGS_TEXT.reasonNameTooLong],
  ['stock.withdrawal_reason_name_taken', 409, SETTINGS_TEXT.reasonNameDuplicate],
])('adding refused with %s shows its line and keeps what was typed', async (code, status, text) => {
  renderScreen(async (url, init) => {
    if (url === '/api/withdrawal-reasons' && init?.method === 'POST') return refusal(status, code)
    throw new Error(`unexpected ${url}`)
  })
  await userEvent.click(await screen.findByRole('button', { name: SETTINGS_TEXT.addWithdrawalReason }))
  await userEvent.type(screen.getByLabelText('Name'), 'Gift')
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))
  expect(await screen.findByText(text)).toBeVisible()
  expect(screen.getByLabelText('Name')).toHaveValue('Gift')
})

/** The row of the reason with this name, so Rename and Delete are taken by name and never by position. */
async function rowOf(name: string): Promise<HTMLElement> {
  const rows = await screen.findAllByRole('listitem')
  const row = rows.find((candidate) => within(candidate).queryByText(name) !== null)
  if (row === undefined) throw new Error(`no row for ${name}`)
  return row
}

test('adding a reason toasts "Reason saved" with no name', async () => {
  const served = [...LIST]
  renderScreen(async (url, init) => {
    if (url === '/api/withdrawal-reasons' && init?.method === 'POST') {
      served.push({ id: 3, name: 'Gift' })
      return jsonResponse(201, { id: 3, name: 'Gift' })
    }
    throw new Error(`unexpected ${url}`)
  }, served)
  await userEvent.click(await screen.findByRole('button', { name: SETTINGS_TEXT.addWithdrawalReason }))
  await screen.findByRole('dialog', { name: SETTINGS_TEXT.addReasonTitle })
  await userEvent.type(await screen.findByLabelText('Name'), 'Gift')
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))
  expect(await screen.findByRole('status')).toHaveTextContent(/^Reason saved$/)
})

test('renaming a reason toasts "Reason saved" with no name and lists the new name', async () => {
  const served = [...LIST]
  renderScreen(async (url, init) => {
    if (url === '/api/withdrawal-reasons/2' && init?.method === 'PATCH') {
      const renamed = { id: 2, name: 'Mine' }
      served.splice(served.findIndex((reason) => reason.id === 2), 1, renamed)
      return jsonResponse(200, renamed)
    }
    throw new Error(`unexpected ${url}`)
  }, served)
  const row = await rowOf('Own use')
  await userEvent.click(within(row).getByRole('button', { name: SETTINGS_TEXT.rename }))
  await screen.findByRole('dialog', { name: SETTINGS_TEXT.renameReasonTitle })
  const field = await screen.findByLabelText('Name')
  await userEvent.clear(field)
  await userEvent.type(field, 'Mine')
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))
  expect(await screen.findByRole('status')).toHaveTextContent(/^Reason saved$/)
  expect(await screen.findByText('Mine')).toBeVisible()
})

test('deleting a reason toasts "Reason deleted" with no name', async () => {
  const served = [...LIST]
  renderScreen(async (url, init) => {
    if (url === '/api/withdrawal-reasons/2' && init?.method === 'DELETE') {
      served.splice(served.findIndex((reason) => reason.id === 2), 1)
      return new Response(null, { status: 204 })
    }
    throw new Error(`unexpected ${url}`)
  }, served)
  const row = await rowOf('Own use')
  await userEvent.click(within(row).getByRole('button', { name: SETTINGS_TEXT.delete }))
  await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: SETTINGS_TEXT.delete }))
  expect(await screen.findByRole('status')).toHaveTextContent(/^Reason deleted$/)
  await waitFor(() => expect(screen.queryByText('Own use')).toBeNull())
})

test.each([
  ['stock.withdrawal_reason_has_withdrawals', SETTINGS_TEXT.cannotDeleteStillHasWithdrawals],
  ['stock.withdrawal_reason_last', SETTINGS_TEXT.cannotDeleteLastReason],
])('deleting refused with %s shows its notice', async (code, text) => {
  renderScreen(async (url, init) => {
    if (url === '/api/withdrawal-reasons/1' && init?.method === 'DELETE') return refusal(409, code)
    throw new Error(`unexpected ${url}`)
  })
  await userEvent.click((await screen.findAllByRole('button', { name: SETTINGS_TEXT.delete }))[0]!)
  expect(screen.getByRole('alertdialog')).toHaveAccessibleName('Delete the reason Marketing?')
  await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: SETTINGS_TEXT.delete }))
  expect(await screen.findByText(text)).toBeVisible()
})
