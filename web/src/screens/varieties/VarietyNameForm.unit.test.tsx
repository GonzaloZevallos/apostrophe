/**
 * `VarietyNameForm` and the unit (`units.md`): a new product always carries a `unit_id`, the
 * business's only unit when it has one, and a required choice when it has several.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import VarietyNameForm from './VarietyNameForm'

const KILOS = { id: 4, name: 'Kilos', label: 'kg', decimals: 2, product_count: 0 }
const PIECES = { id: 5, name: 'Pieces', label: 'pc', decimals: 0, product_count: 0 }

afterEach(() => {
  vi.unstubAllGlobals()
})

function reply(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

function renderForm(units: unknown[]) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === '/api/units') return reply(200, units)
    if (url === '/api/products' && init?.method === 'POST') return reply(201, { id: 1, name: 'Mango' })
    throw new Error(`unexpected ${url}`)
  })
  vi.stubGlobal('fetch', fetchMock)
  render(
    <QueryClientProvider client={new QueryClient()}>
      <VarietyNameForm onSaved={vi.fn()} onDirtyChange={vi.fn()} />
    </QueryClientProvider>,
  )
  return fetchMock
}

function postBody(fetchMock: ReturnType<typeof renderForm>): unknown {
  const call = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')
  return call === undefined ? undefined : JSON.parse(String(call[1]?.body))
}

test('with one unit the request carries its id and no choice is shown', async () => {
  const fetchMock = renderForm([KILOS])
  await userEvent.type(await screen.findByRole('textbox'), 'Mango')
  await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/units', expect.anything()))
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /add/i }))
  await vi.waitFor(() => expect(postBody(fetchMock)).toEqual({ name: 'Mango', unit_id: 4 }))
})

test('with two units the choice is required and the picked id is sent', async () => {
  const fetchMock = renderForm([KILOS, PIECES])
  const select = await screen.findByRole('combobox', { name: 'Unit' })
  await userEvent.type(screen.getByRole('textbox'), 'Mango')
  await userEvent.click(screen.getByRole('button', { name: /add/i }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Choose a unit.')
  expect(postBody(fetchMock)).toBeUndefined()
  await userEvent.selectOptions(select, 'Pieces')
  await userEvent.click(screen.getByRole('button', { name: /add/i }))
  await vi.waitFor(() => expect(postBody(fetchMock)).toEqual({ name: 'Mango', unit_id: 5 }))
})
