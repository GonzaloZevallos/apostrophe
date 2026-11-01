/**
 * `UnitsGroup` at the screen seam (Settings → Products → Units): the list in creation order,
 * the form's field refusals, the delete confirmation and the two sentence cards that replace
 * it (`unit.in_use`, `unit.last_unit`). The API is faked at `fetch`.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import { SETTINGS, SETTINGS_UNITS } from '../../routes'
import { inAppState } from '../../components/inAppState'
import UnitsGroup from './UnitsGroup'

const UNITS = [
  { id: 1, name: 'Kilos', label: 'kg', decimals: 2, product_count: 0 },
  { id: 2, name: 'Pieces', label: 'pc', decimals: 0, product_count: 3 },
]

function reply(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

type Handler = (url: string, init?: RequestInit) => Response | undefined

function renderGroup(units: typeof UNITS, handler: Handler = () => undefined) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const answer = handler(url, init)
    if (answer !== undefined) return answer
    if (url === '/api/units' && (init?.method ?? 'GET') === 'GET') return reply(200, units)
    throw new Error(`unexpected ${init?.method ?? 'GET'} ${url}`)
  })
  vi.stubGlobal('fetch', fetchMock)
  const router = createMemoryRouter(
    [
      { path: SETTINGS, element: <div>groups</div> },
      { path: SETTINGS_UNITS, element: <UnitsGroup /> },
    ],
    {
      initialEntries: [SETTINGS, { pathname: SETTINGS_UNITS, state: inAppState({ pathname: SETTINGS }) }],
      initialIndex: 1,
    },
  )
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return fetchMock
}

afterEach(() => {
  vi.unstubAllGlobals()
})

test('lists the units in order with a named Edit and Delete on each', async () => {
  renderGroup(UNITS)
  expect(await screen.findByText('Kilos')).toBeInTheDocument()
  expect(screen.getByText('kg · 2 decimals')).toBeInTheDocument()
  expect(screen.getByText('pc · Whole units only')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Edit Pieces' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Delete Kilos' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '+ New unit' })).toBeInTheDocument()
})

test('creates a unit with the typed name, label and decimals', async () => {
  const fetchMock = renderGroup(UNITS, (url, init) =>
    url === '/api/units' && init?.method === 'POST' ? reply(201, { ...UNITS[0], id: 9 }) : undefined,
  )
  await userEvent.click(await screen.findByRole('button', { name: '+ New unit' }))
  await userEvent.type(screen.getByLabelText('Name'), 'Liters')
  await userEvent.type(screen.getByLabelText('Label'), 'l')
  await userEvent.click(screen.getByRole('radio', { name: '1' }))
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))
  const post = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')
  expect(JSON.parse(String(post?.[1]?.body))).toEqual({ name: 'Liters', label: 'l', decimals: 1 })
})

test('an empty form names what is missing and sends nothing', async () => {
  const fetchMock = renderGroup(UNITS)
  await userEvent.click(await screen.findByRole('button', { name: '+ New unit' }))
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))
  expect(screen.getByText('Enter a name.')).toBeInTheDocument()
  expect(screen.getByText('Enter a label.')).toBeInTheDocument()
  expect(screen.getByText('Choose how many decimals.')).toBeInTheDocument()
  expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false)
})

test('unit.name_taken shows under the name and keeps what was typed', async () => {
  renderGroup(UNITS, (url, init) =>
    url === '/api/units' && init?.method === 'POST' ? reply(409, { code: 'unit.name_taken' }) : undefined,
  )
  await userEvent.click(await screen.findByRole('button', { name: '+ New unit' }))
  await userEvent.type(screen.getByLabelText('Name'), 'kilos')
  await userEvent.type(screen.getByLabelText('Label'), 'k')
  await userEvent.click(screen.getByRole('radio', { name: '0' }))
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))
  expect(await screen.findByText('You already have a unit with this name.')).toBeInTheDocument()
  expect(screen.getByLabelText('Name')).toHaveValue('kilos')
})

test('unit.decimals_in_use shows under the decimals with how many the recorded quantities use', async () => {
  renderGroup(UNITS, (url, init) =>
    url === '/api/units/1' && init?.method === 'PATCH' ? reply(409, { code: 'unit.decimals_in_use' }) : undefined,
  )
  await userEvent.click(await screen.findByRole('button', { name: 'Edit Kilos' }))
  await userEvent.click(screen.getByRole('radio', { name: '0' }))
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))
  expect(await screen.findByText('Recorded quantities already use 2 decimals.')).toBeInTheDocument()
  expect(screen.getByRole('radio', { name: '0' })).toBeChecked()
})

test('closing a typed form asks first and keeping goes back to it', async () => {
  renderGroup(UNITS)
  await userEvent.click(await screen.findByRole('button', { name: '+ New unit' }))
  await userEvent.type(screen.getByLabelText('Name'), 'Li')
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close' }))
  const dialog = screen.getByRole('alertdialog', { name: 'Discard the unit?' })
  await userEvent.click(within(dialog).getByRole('button', { name: 'No, keep editing' }))
  expect(screen.getByLabelText('Name')).toHaveValue('Li')
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close' }))
  await userEvent.click(screen.getByRole('button', { name: 'Yes, discard' }))
  expect(screen.queryByLabelText('Name')).not.toBeInTheDocument()
})

test('a unit nobody uses is deleted after a confirmation', async () => {
  const fetchMock = renderGroup(UNITS, (url, init) =>
    url === '/api/units/1' && init?.method === 'DELETE' ? new Response(null, { status: 204 }) : undefined,
  )
  await userEvent.click(await screen.findByRole('button', { name: 'Delete Kilos' }))
  expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(false)
  const dialog = screen.getByRole('alertdialog', { name: 'Delete Kilos?' })
  await userEvent.click(within(dialog).getByRole('button', { name: 'Yes, delete' }))
  expect(fetchMock.mock.calls.some(([url, init]) => url === '/api/units/1' && init?.method === 'DELETE')).toBe(true)
})

test('a unit in use shows the count sentence with More info and no dialog', async () => {
  const fetchMock = renderGroup(UNITS)
  await userEvent.click(await screen.findByRole('button', { name: 'Delete Pieces' }))
  expect(screen.getByText('3 products use this unit.')).toBeInTheDocument()
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'More info' }))
  expect(screen.getByText(/keeps its unit for good/)).toBeInTheDocument()
  expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(false)
})

test('the only unit left answers that the business needs one', async () => {
  const fetchMock = renderGroup([UNITS[0]!])
  await userEvent.click(await screen.findByRole('button', { name: 'Delete Kilos' }))
  expect(screen.getByText('Your business needs at least one unit.')).toBeInTheDocument()
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(false)
})

test('a server unit.in_use on delete shows the same card', async () => {
  renderGroup(UNITS, (url, init) =>
    url === '/api/units/1' && init?.method === 'DELETE' ? reply(409, { code: 'unit.in_use' }) : undefined,
  )
  await userEvent.click(await screen.findByRole('button', { name: 'Delete Kilos' }))
  await userEvent.click(screen.getByRole('button', { name: 'Yes, delete' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('0 products use this unit.')
})
