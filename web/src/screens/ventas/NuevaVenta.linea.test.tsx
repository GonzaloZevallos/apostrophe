/**
 * `NuevaVenta`'s open line on the phone, at the screen seam with `fetch` faked: Regalo is
 * a whole-row switch (not a 13 px native checkbox) that still excludes "Precio especial"
 * both ways, grams open a decimal keypad and pesos a numeric one, and the line's fields
 * carry the `enterkeyhint` that moves the keyboard through them.
 */

import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import App from '../../App'
import { queryClient } from '../../queryClient'
import { router } from '../../router'

const ME = { email: 'ana@x.com', business_name: 'La Huerta', today: '2026-10-02' }
const ROSA = {
  id: 1,
  name: 'Rosa',
  current_price: { id: 9, effective_from: '2026-09-01', list_price: 1000, bulk_price: null, bulk_minimum: null },
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

async function openForm(): Promise<ReturnType<typeof vi.fn>> {
  const fetchMock = vi.fn((path: string) => {
    if (path === '/auth/me') return Promise.resolve(jsonResponse(200, ME))
    if (path === '/varieties?on=2026-10-02') return Promise.resolve(jsonResponse(200, [ROSA]))
    return Promise.reject(new Error(`unexpected request: ${path}`))
  })
  vi.stubGlobal('fetch', fetchMock)
  await act(() => router.navigate('/ventas'))
  await act(() => router.navigate('/ventas/nueva'))
  render(<App />)
  await screen.findByText('Nueva venta')
  await screen.findByRole('option', { name: 'Rosa' })
  return fetchMock
}

afterEach(async () => {
  vi.unstubAllGlobals()
  queryClient.clear()
  await act(() => router.navigate('/'))
})

test('Regalo is a switch whose whole row toggles it, and it excludes Precio especial both ways', async () => {
  const user = userEvent.setup()
  await openForm()

  const gift = screen.getByRole('switch', { name: 'Regalo línea 1' })
  expect(gift).not.toBeChecked()
  await user.click(screen.getByText('Regalo'))
  expect(gift).toBeChecked()
  expect(screen.getByLabelText('Precio especial línea 1')).toBeDisabled()

  await user.click(screen.getByText('Regalo'))
  expect(gift).not.toBeChecked()
  await user.type(screen.getByLabelText('Precio especial línea 1'), '500')
  expect(gift).toBeDisabled()
})

test('grams open a decimal keypad, pesos a numeric one, and the keyboard key moves through the line', async () => {
  await openForm()

  const grams = screen.getByLabelText('Gramos línea 1')
  const special = screen.getByLabelText('Precio especial línea 1')
  expect(grams).toHaveAttribute('inputmode', 'decimal')
  expect(grams).toHaveAttribute('enterkeyhint', 'next')
  expect(special).toHaveAttribute('inputmode', 'numeric')
  expect(special).toHaveAttribute('enterkeyhint', 'done')
  expect(screen.getByLabelText('Envío')).toHaveAttribute('inputmode', 'numeric')
})

test('the keyboard key moves from grams to Precio especial, then closes the keyboard, and never saves', async () => {
  const user = userEvent.setup()
  const fetchMock = await openForm()

  await user.selectOptions(screen.getByLabelText('Variedad línea 1'), '1')
  await user.type(screen.getByLabelText('Gramos línea 1'), '2{Enter}')
  expect(screen.getByLabelText('Precio especial línea 1')).toBe(document.activeElement)

  await user.type(screen.getByLabelText('Precio especial línea 1'), '500{Enter}')
  expect(screen.getByLabelText('Precio especial línea 1')).not.toBe(document.activeElement)
  expect(fetchMock.mock.calls.map(([path]) => path)).not.toContain('/sales')
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test('on a computer Regalo is the plain checkbox the design always had, not the phone switch', async () => {
  const user = userEvent.setup()
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: query === '(min-width: 900px)',
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    })),
  )
  await openForm()

  expect(screen.queryByRole('switch')).not.toBeInTheDocument()
  const gift = screen.getByRole('checkbox', { name: 'Regalo línea 1' })
  await user.click(gift)
  expect(gift).toBeChecked()
  expect(screen.getByLabelText('Precio especial línea 1')).toBeDisabled()
})

test('with Regalo on, the keyboard key on grams closes the keyboard instead of stalling on a disabled field', async () => {
  const user = userEvent.setup()
  await openForm()

  await user.click(screen.getByText('Regalo'))
  await user.type(screen.getByLabelText('Gramos línea 1'), '2{Enter}')
  expect(screen.getByLabelText('Gramos línea 1')).not.toBe(document.activeElement)
})
