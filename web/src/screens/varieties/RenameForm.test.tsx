/**
 * `RenameForm` at the component seam: renames a variety (`PATCH /varieties/{id}`). Its
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

test('starts on the saved name; a save patches the new name and hands "Variedad guardada" to its host', async () => {
  const user = userEvent.setup()
  const { fetchMock } = renderHost(async () => jsonResponse(200, { id: 1, name: 'Gold 24K' }))

  const input = screen.getByLabelText('Nombre')
  expect(input).toHaveValue('24K Gold')
  await user.clear(input)
  await user.type(input, 'Gold 24K')
  await user.click(screen.getByRole('button', { name: 'Guardá el nombre' }))

  expect(await screen.findByText(/state: saved Variedad guardada/)).toBeInTheDocument()
  expect(writes(fetchMock)).toEqual([{ call: 'PATCH /varieties/1', body: { name: 'Gold 24K' } }])
})

test('a save marks the catalog stale', async () => {
  const user = userEvent.setup()
  const { queryClient } = renderHost(async () => jsonResponse(200, { id: 1, name: 'Gold' }))
  queryClient.setQueryData(catalogQueryOptions().queryKey, { text: null, header: '', footer: '', varieties: [] })

  await user.type(screen.getByLabelText('Nombre'), 'x')
  await user.click(screen.getByRole('button', { name: 'Guardá el nombre' }))
  await screen.findByText(/state: saved/)

  expect(queryClient.getQueryState(catalogQueryOptions().queryKey)?.isInvalidated).toBe(true)
})

test('it tells its host when something was typed', async () => {
  const user = userEvent.setup()
  renderHost(async () => jsonResponse(200, {}))

  expect(screen.getByText(/dirty: false/)).toBeInTheDocument()
  await user.type(screen.getByLabelText('Nombre'), 'x')
  expect(screen.getByText(/dirty: true/)).toBeInTheDocument()
})

test('a taken name is refused under the name and keeps what was typed', async () => {
  const user = userEvent.setup()
  renderHost(async () => jsonResponse(409, { code: 'variety.name_taken' }))

  await user.type(screen.getByLabelText('Nombre'), ' 2')
  await user.click(screen.getByRole('button', { name: 'Guardá el nombre' }))

  const alert = await screen.findByRole('alert')
  expect(alert.closest('label')).toHaveTextContent('Nombre')
  expect(alert).toHaveTextContent('Ya existe una variedad con ese nombre')
  expect(screen.getByLabelText(/^Nombre/)).toHaveValue('24K Gold 2')
  expect(screen.getByText(/state: open/)).toBeInTheDocument()
})

test('an invalid name is refused under the name', async () => {
  const user = userEvent.setup()
  renderHost(async () => jsonResponse(422, { code: 'variety.name_invalid' }))

  await user.type(screen.getByLabelText('Nombre'), '!')
  await user.click(screen.getByRole('button', { name: 'Guardá el nombre' }))

  expect(await screen.findByRole('alert')).toBeInTheDocument()
  expect(screen.getByText(/state: open/)).toBeInTheDocument()
})

test('a variety that is gone is handed to the host', async () => {
  const user = userEvent.setup()
  renderHost(async () => jsonResponse(404, { code: 'variety.not_found' }))

  await user.type(screen.getByLabelText('Nombre'), 'x')
  await user.click(screen.getByRole('button', { name: 'Guardá el nombre' }))

  expect(await screen.findByText(/state: gone/)).toBeInTheDocument()
})

test('"Cerrar" hands the exit to the host', async () => {
  const user = userEvent.setup()
  renderHost(async () => jsonResponse(200, {}))

  await user.click(screen.getByRole('button', { name: 'Cerrar' }))

  expect(screen.getByText(/state: closed/)).toBeInTheDocument()
})
