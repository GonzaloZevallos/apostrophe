/**
 * `NuevaVentaSheet`'s line rows at the component seam (Testing Library, `fetch` faked, the shared
 * harness in `renderNuevaVentaSheet.tsx`): the "No price" row, the tap on a line's name and price that
 * asks the host to open its detail, and the −, quantity and + that never do.
 */

import { cleanup, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { renderNuevaVentaSheet } from './renderNuevaVentaSheet'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const dialog = () => screen.getByRole('dialog', { name: 'New sale' })
const inSale = () => screen.findByRole('heading', { name: /^In the sale/ })

test('a line with no price shows "No price", − and the quantity, no +, never $0, and opens the detail', async () => {
  const { onOpenLine } = renderNuevaVentaSheet({ lines: [{ productId: 3, quantity: '2' }] })
  await inSale()
  const open = await within(dialog()).findByRole('button', { name: 'Edit Sin precio' })
  expect(within(open).getByText('No price')).toBeInTheDocument()
  expect(within(open).queryByText(/\$/)).toBeNull()
  const steps = within(dialog()).getByRole('group', { name: 'Sin precio' })
  expect(within(steps).getByRole('button', { name: 'Remove one Sin precio' })).toBeInTheDocument()
  expect(within(steps).queryByRole('button', { name: 'Add one Sin precio' })).toBeNull()
  expect(within(steps).getByText('2')).toBeInTheDocument()
  await userEvent.click(open)
  expect(onOpenLine).toHaveBeenCalledExactlyOnceWith(3)
})

test('a priced line shows its price and opens the detail by its name and price', async () => {
  const { onOpenLine } = renderNuevaVentaSheet({ lines: [{ productId: 1, quantity: '1' }] })
  await inSale()
  const open = await within(dialog()).findByRole('button', { name: 'Edit Rosa' })
  await userEvent.click(within(open).getByText('Rosa'))
  expect(onOpenLine).toHaveBeenCalledExactlyOnceWith(1)
  expect(within(open).queryByText('No price')).toBeNull()
})

test('a "no longer available" line opens the detail', async () => {
  const { onOpenLine } = renderNuevaVentaSheet({ lines: [{ productId: 99, quantity: '1' }] })
  await inSale()
  await userEvent.click(await within(dialog()).findByRole('button', { name: /^Edit .*no longer available/i }))
  expect(onOpenLine).toHaveBeenCalledExactlyOnceWith(99)
})

test('−, the quantity and + never open the detail', async () => {
  const { onOpenLine, draft } = renderNuevaVentaSheet({ lines: [{ productId: 1, quantity: '2' }] })
  await inSale()
  const steps = await within(dialog()).findByRole('group', { name: 'Rosa' })
  await userEvent.click(within(steps).getByRole('button', { name: 'Add one Rosa' }))
  await userEvent.click(within(steps).getByRole('button', { name: 'Remove one Rosa' }))
  await userEvent.click(within(steps).getByText('2'))
  expect(onOpenLine).not.toHaveBeenCalled()
  expect(draft().state.lines).toHaveLength(1)
})

test('a row that is not in the sale keeps "No price" with no icon and no open button', async () => {
  const { onOpenLine } = renderNuevaVentaSheet()
  await screen.findByRole('heading', { name: 'Most sold' })
  const row = within(dialog()).getByText('Sin precio').closest('li')
  if (row === null) throw new Error('the row is missing')
  expect(within(row).getByText('No price')).toBeInTheDocument()
  expect(within(row).queryByRole('button')).toBeNull()
  expect(onOpenLine).not.toHaveBeenCalled()
})
