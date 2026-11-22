/**
 * `NuevaVentaSheet`'s Customer row at the component seam (Testing Library, `fetch` faked, the shared
 * harness in `renderNuevaVentaSheet.tsx`): the name, the price line beneath it, the Loading marks, the
 * failed reads and Change.
 */

import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import type { CustomerView } from '../../sales/newSaleView'
import { renderNuevaVentaSheet, type SheetCase } from './renderNuevaVentaSheet'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const dialog = () => screen.getByRole('dialog', { name: 'New sale' })
/** Resolves once the Products read is in, so the price line has its settings. */
const listed = () => screen.findByRole('heading', { name: 'Most sold' })
const KNOWN_NO_TYPE: CustomerView = { kind: 'known', name: 'Ana', typeId: null, typeName: null }
const KNOWN_TYPED: CustomerView = { kind: 'known', name: 'Ana', typeId: 7, typeName: 'Mayorista' }

test('with no customer the row says so and shows List prices', async () => {
  renderNuevaVentaSheet({ customer: { kind: 'none' } })
  expect(within(dialog()).getByText('No customer')).toBeInTheDocument()
  expect(await within(dialog()).findByText('List prices')).toBeInTheDocument()
})

test('a Customer with no type shows the name and List prices', async () => {
  renderNuevaVentaSheet({ customer: KNOWN_NO_TYPE })
  expect(within(dialog()).getByText('Ana')).toBeInTheDocument()
  expect(await within(dialog()).findByText('List prices')).toBeInTheDocument()
  expect(within(dialog()).queryByText('No customer')).toBeNull()
})

test('a Customer with a type shows Prices for that type', async () => {
  renderNuevaVentaSheet({ customer: KNOWN_TYPED })
  expect(await within(dialog()).findByText('Prices for Mayorista')).toBeInTheDocument()
  expect(within(dialog()).queryByText('List prices')).toBeNull()
})

test('with the Customer types switch off a typed Customer shows List prices', async () => {
  renderNuevaVentaSheet({ customer: KNOWN_TYPED, vip: false })
  expect(await within(dialog()).findByText('List prices')).toBeInTheDocument()
  expect(within(dialog()).queryByText(/Prices for/)).toBeNull()
})

test('while the settings are pending the price line is only the Loading mark', async () => {
  renderNuevaVentaSheet({ customer: KNOWN_TYPED, held: ['settings'] })
  expect(within(dialog()).getByText('Ana')).toBeInTheDocument()
  const text = dialog().textContent ?? ''
  expect(text).not.toMatch(/List prices|Prices for/)
})

test('while the name is pending the Loading mark takes its place and no price line shows', async () => {
  renderNuevaVentaSheet({ customer: { kind: 'namePending' } })
  await listed()
  expect(within(dialog()).queryByText('No customer')).toBeNull()
  expect(within(dialog()).queryByText(/List prices|Prices for/)).toBeNull()
  expect(within(dialog()).getByRole('button', { name: 'Change' })).toBeInTheDocument()
})

test('while the type is pending the name shows and the price line is the Loading mark', async () => {
  renderNuevaVentaSheet({ customer: { kind: 'typePending', name: 'Ana' } })
  await listed()
  expect(within(dialog()).getByText('Ana')).toBeInTheDocument()
  expect(within(dialog()).queryByText(/List prices|Prices for/)).toBeNull()
})

test.each<[string, SheetCase]>([
  ['a failed Customer read that has a name', { customer: { kind: 'failed', name: 'Ana' } }],
  ['a failed Customer read with no name', { customer: { kind: 'failed', name: null } }],
  ['a failed Products read', { customer: KNOWN_TYPED, broken: ['products'] }],
  ['a failed Pricing settings read', { customer: KNOWN_TYPED, broken: ['settings'] }],
])('%s shows no price line and no figure', async (_name, spec) => {
  renderNuevaVentaSheet(spec)
  await waitFor(() => expect(within(dialog()).getByRole('button', { name: 'Change' })).toBeInTheDocument())
  // Let every read settle before looking for what must not be there.
  await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalledTimes(4))
  await new Promise((resolve) => setTimeout(resolve, 50))
  const text = dialog().textContent ?? ''
  expect(text).not.toMatch(/List prices|Prices for/)
  expect(text).not.toContain('$')
})

test('a failed Customer read shows the name it has and Change', async () => {
  renderNuevaVentaSheet({ customer: { kind: 'failed', name: 'Ana' } })
  expect(within(dialog()).getByText('Ana')).toBeInTheDocument()
  expect(within(dialog()).getByRole('button', { name: 'Change' })).toBeInTheDocument()
})

test('a 60-character name keeps its full accessible name', async () => {
  const name = 'Margarita de los Ángeles Fernández de la Vega y Montenegro X'
  expect(name).toHaveLength(60)
  renderNuevaVentaSheet({ customer: { kind: 'known', name, typeId: null, typeName: null } })
  expect(within(dialog()).getByText(name)).toBeInTheDocument()
  await listed()
})

test('Change reads Change with no customer too, and raises onChangeCustomer', async () => {
  const { onChangeCustomer } = renderNuevaVentaSheet({ customer: { kind: 'none' } })
  await userEvent.click(within(dialog()).getByRole('button', { name: 'Change' }))
  expect(onChangeCustomer).toHaveBeenCalledTimes(1)
})

test('Close raises onClose with no dialog of its own', async () => {
  const { onClose } = renderNuevaVentaSheet({ customer: KNOWN_NO_TYPE, lines: [{ productId: 1, quantity: '2' }] })
  await userEvent.click(within(dialog()).getByRole('button', { name: 'Close' }))
  expect(onClose).toHaveBeenCalledTimes(1)
  expect(screen.getAllByRole('dialog')).toHaveLength(1)
})
