/**
 * `VarietyNameForm` at the component seam: adds a variety (`POST /varieties`). Its host owns
 * the exits, so a tiny host stands in for `VarietyNew` and the Onboarding. A refusal shows
 * under the name and keeps what was typed.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, expect, test, vi } from 'vitest'
import { keys } from '../../api/keys'
import { jsonResponse, writes, type FetchImpl } from './renderVarieties'
import VarietyNameForm from './VarietyNameForm'

afterEach(() => {
  vi.unstubAllGlobals()
})

function Host() {
  const [state, setState] = useState<string>('open')
  const [dirty, setDirty] = useState(false)
  return (
    <div>
      <span>{`state: ${state}; dirty: ${String(dirty)}`}</span>
      <VarietyNameForm
        onSaved={(saved) => setState(`saved ${String(saved.id)} ${saved.name}`)}
        onDirtyChange={setDirty}
      />
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

test('a save posts the name to the owner route and hands the id and name to its host', async () => {
  const user = userEvent.setup()
  const { fetchMock } = renderHost(async () => jsonResponse(201, { id: 7, name: 'Gold 24K' }))

  await user.type(screen.getByLabelText(/^Nombre/), 'Gold 24K')
  await user.click(screen.getByRole('button', { name: 'Agregá la variedad' }))

  expect(await screen.findByText(/state: saved 7 Gold 24K/)).toBeInTheDocument()
  expect(writes(fetchMock)).toEqual([{ call: 'POST /varieties', body: { name: 'Gold 24K' } }])
})

test('a save marks the varieties stale', async () => {
  const user = userEvent.setup()
  const { queryClient } = renderHost(async () => jsonResponse(201, { id: 1, name: 'Gold' }))
  queryClient.setQueryData(keys.varieties(), [])

  await user.type(screen.getByLabelText(/^Nombre/), 'Gold')
  await user.click(screen.getByRole('button', { name: 'Agregá la variedad' }))
  await screen.findByText(/state: saved/)

  expect(queryClient.getQueryState(keys.varieties())?.isInvalidated).toBe(true)
})

test('it starts empty and tells its host when something was typed', async () => {
  const user = userEvent.setup()
  renderHost(async () => jsonResponse(201, {}))

  expect(screen.getByLabelText(/^Nombre/)).toHaveValue('')
  expect(screen.getByText(/dirty: false/)).toBeInTheDocument()
  await user.type(screen.getByLabelText(/^Nombre/), 'x')
  expect(screen.getByText(/dirty: true/)).toBeInTheDocument()
})

test('a taken name is refused under the name and keeps what was typed', async () => {
  const user = userEvent.setup()
  renderHost(async () => jsonResponse(409, { code: 'variety.name_taken' }))

  await user.type(screen.getByLabelText(/^Nombre/), 'Gold')
  await user.click(screen.getByRole('button', { name: 'Agregá la variedad' }))

  const alert = await screen.findByRole('alert')
  expect(alert.closest('label')).toHaveTextContent('Nombre')
  expect(alert).toHaveTextContent('Ya existe una variedad con ese nombre')
  expect(screen.getByLabelText(/^Nombre/)).toHaveValue('Gold')
  expect(screen.getByText(/state: open/)).toBeInTheDocument()
})
