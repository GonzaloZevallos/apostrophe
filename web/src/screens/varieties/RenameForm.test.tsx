/**
 * `RenameForm` at the component seam: renames a variety (`PATCH /api/products/{id}`). Its
 * host owns the exits, so a tiny host stands in for the variety's page, which opens the
 * form through history state. A refusal shows under the name and keeps what was typed.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, expect, test, vi } from 'vitest'
import { catalogQueryOptions } from '../../api/catalog'
import { jsonResponse, writes, type FetchImpl } from './renderVarieties'
import RenameForm from './RenameForm'

afterEach(() => {
  vi.unstubAllGlobals()
})

function Host() {
  const [state, setState] = useState<string>('open')
  const [dirty, setDirty] = useState(false)
  return (
    <div>
      <span>{`state: ${state}; dirty: ${String(dirty)}`}</span>
      {state === 'open' && (
        <RenameForm
          variety={{ id: 1, name: '24K Gold' }}
          onDone={(saved) => setState(`saved ${saved}`)}
          onCancel={() => setState('closed')}
          onDirtyChange={setDirty}
          onGone={() => setState('gone')}
        />
      )}
    </div>
  )
}

function renderHost(fetchImpl: FetchImpl) {
  const fetchMock = vi.fn(fetchImpl)
  vi.stubGlobal('fetch', fetchMock)
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <Host />
    </QueryClientProvider>,
  )
  return { fetchMock, queryClient }
}

test('starts on the saved name; a save patches the new name and hands "Variety saved" to its host', async () => {
  const user = userEvent.setup()
  const { fetchMock } = renderHost(async () => jsonResponse(200, { id: 1, name: 'Gold 24K' }))

  const input = screen.getByLabelText('Name')
  expect(input).toHaveValue('24K Gold')
  await user.clear(input)
  await user.type(input, 'Gold 24K')
  await user.click(screen.getByRole('button', { name: 'Save the name' }))

  expect(await screen.findByText(/state: saved Variety saved/)).toBeInTheDocument()
  expect(writes(fetchMock)).toEqual([{ call: 'PATCH /api/products/1', body: { name: 'Gold 24K' } }])
})

test('a save marks the catalog stale', async () => {
  const user = userEvent.setup()
  const { queryClient } = renderHost(async () => jsonResponse(200, { id: 1, name: 'Gold' }))
  queryClient.setQueryData(catalogQueryOptions().queryKey, { text: null, header: '', footer: '', varieties: [] })

  await user.type(screen.getByLabelText('Name'), 'x')
  await user.click(screen.getByRole('button', { name: 'Save the name' }))
  await screen.findByText(/state: saved/)

  expect(queryClient.getQueryState(catalogQueryOptions().queryKey)?.isInvalidated).toBe(true)
})

test('it tells its host when something was typed', async () => {
  const user = userEvent.setup()
  renderHost(async () => jsonResponse(200, {}))

  expect(screen.getByText(/dirty: false/)).toBeInTheDocument()
  await user.type(screen.getByLabelText('Name'), 'x')
  expect(screen.getByText(/dirty: true/)).toBeInTheDocument()
})

test('a taken name is refused under the name and keeps what was typed', async () => {
  const user = userEvent.setup()
  renderHost(async () => jsonResponse(409, { code: 'variety.name_taken' }))

  await user.type(screen.getByLabelText('Name'), ' 2')
  await user.click(screen.getByRole('button', { name: 'Save the name' }))

  const alert = await screen.findByRole('alert')
  expect(alert.closest('label')).toHaveTextContent('Name')
  expect(alert).toHaveTextContent('A variety with that name already exists')
  expect(screen.getByLabelText(/^Name/)).toHaveValue('24K Gold 2')
  expect(screen.getByText(/state: open/)).toBeInTheDocument()
})

test('a name held by an archived variety is refused under the name with its own text', async () => {
  const user = userEvent.setup()
  renderHost(async () => jsonResponse(409, { code: 'variety.name_archived' }))

  await user.type(screen.getByLabelText('Name'), ' 2')
  await user.click(screen.getByRole('button', { name: 'Save the name' }))

  const alert = await screen.findByRole('alert')
  expect(alert.closest('label')).toHaveTextContent('Name')
  expect(alert).toHaveTextContent('That name belongs to an archived variety. Look for it in Archived.')
  expect(screen.getByLabelText(/^Name/)).toHaveValue('24K Gold 2')
})

test('an invalid name is refused under the name', async () => {
  const user = userEvent.setup()
  renderHost(async () => jsonResponse(422, { code: 'variety.name_invalid' }))

  await user.type(screen.getByLabelText('Name'), '!')
  await user.click(screen.getByRole('button', { name: 'Save the name' }))

  expect(await screen.findByRole('alert')).toBeInTheDocument()
  expect(screen.getByText(/state: open/)).toBeInTheDocument()
})

test('a variety that is gone is handed to the host', async () => {
  const user = userEvent.setup()
  renderHost(async () => jsonResponse(404, { code: 'variety.not_found' }))

  await user.type(screen.getByLabelText('Name'), 'x')
  await user.click(screen.getByRole('button', { name: 'Save the name' }))

  expect(await screen.findByText(/state: gone/)).toBeInTheDocument()
})

test('"Close" hands the exit to the host', async () => {
  const user = userEvent.setup()
  renderHost(async () => jsonResponse(200, {}))

  await user.click(screen.getByRole('button', { name: 'Close' }))

  expect(screen.getByText(/state: closed/)).toBeInTheDocument()
})
