/**
 * `SelectorPago` at the component seam (plan, "Components": "covering roles,
 * disabled Debiendo with its description, selection and no selection"). Replaces
 * the native payment radio fieldset (PM, adjustment 2) — same roles and
 * accessible names a `role="radiogroup"` of `role="radio"`s gives natively.
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import SelectorPago from './SelectorPago'

test('is a radiogroup of three radios named Efectivo, Transferencia and Debiendo', () => {
  render(<SelectorPago value={null} onChange={() => {}} />)
  expect(screen.getByRole('radiogroup', { name: 'Cómo se pagó' })).toBeInTheDocument()
  expect(screen.getByRole('radio', { name: 'Efectivo' })).toBeInTheDocument()
  expect(screen.getByRole('radio', { name: 'Transferencia' })).toBeInTheDocument()
  expect(screen.getByRole('radio', { name: 'Debiendo' })).toBeInTheDocument()
})

test('allows no selection: none of the three is checked', () => {
  render(<SelectorPago value={null} onChange={() => {}} />)
  for (const radio of screen.getAllByRole('radio')) {
    expect(radio).toHaveAttribute('aria-checked', 'false')
  }
})

test('marks the chosen option checked, and only that one', () => {
  render(<SelectorPago value="cash" onChange={() => {}} />)
  expect(screen.getByRole('radio', { name: 'Efectivo' })).toHaveAttribute('aria-checked', 'true')
  expect(screen.getByRole('radio', { name: 'Transferencia' })).toHaveAttribute('aria-checked', 'false')
  expect(screen.getByRole('radio', { name: 'Debiendo' })).toHaveAttribute('aria-checked', 'false')
})

test('a disabled Debiendo carries the caller\'s description as its accessible description', () => {
  render(
    <SelectorPago
      value={null}
      onChange={() => {}}
      owingDisabled
      owingDescription="Para dejar debiendo elegí un cliente"
    />,
  )
  const owing = screen.getByRole('radio', { name: 'Debiendo' })
  expect(owing).toBeDisabled()
  expect(screen.getByText('Para dejar debiendo elegí un cliente')).toBeInTheDocument()
  const describedBy = owing.getAttribute('aria-describedby')
  expect(describedBy).not.toBeNull()
  expect(document.getElementById(describedBy as string)?.textContent).toBe(
    'Para dejar debiendo elegí un cliente',
  )
})

test('a disabled Debiendo never fires onChange', async () => {
  const onChange = vi.fn()
  render(<SelectorPago value={null} onChange={onChange} owingDisabled owingDescription="x" />)
  screen.getByRole('radio', { name: 'Debiendo' }).click()
  expect(onChange).not.toHaveBeenCalled()
})

test('clicking an enabled option fires onChange with its value', async () => {
  const user = userEvent.setup()
  const onChange = vi.fn()
  render(<SelectorPago value={null} onChange={onChange} />)
  await user.click(screen.getByRole('radio', { name: 'Transferencia' }))
  expect(onChange).toHaveBeenCalledWith('transfer')
})
