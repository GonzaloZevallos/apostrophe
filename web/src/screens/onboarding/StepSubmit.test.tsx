/**
 * `StepSubmit` at the component seam: a step's next action is a real form submit, drawn
 * as a text-only `Boton`.
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import StepSubmit from './StepSubmit'

test('the button is a submit inside a form, named by its word', () => {
  render(<StepSubmit onSubmit={() => {}}>Seguir</StepSubmit>)
  const button = screen.getByRole('button', { name: 'Seguir' })
  expect(button).toHaveAttribute('type', 'submit')
  expect(button.closest('form')).not.toBeNull()
})

test('one click calls onSubmit exactly once', async () => {
  const onSubmit = vi.fn()
  render(<StepSubmit onSubmit={onSubmit}>Seguir</StepSubmit>)
  await userEvent.click(screen.getByRole('button', { name: 'Seguir' }))
  expect(onSubmit).toHaveBeenCalledTimes(1)
})

test('disabled blocks the call', async () => {
  const onSubmit = vi.fn()
  render(
    <StepSubmit onSubmit={onSubmit} disabled>
      Seguir
    </StepSubmit>,
  )
  const button = screen.getByRole('button', { name: 'Seguir' })
  expect(button).toBeDisabled()
  await userEvent.click(button)
  expect(onSubmit).not.toHaveBeenCalled()
})

test('focusing the button and pressing Enter submits', async () => {
  const onSubmit = vi.fn()
  render(<StepSubmit onSubmit={onSubmit}>Dejar así</StepSubmit>)
  screen.getByRole('button', { name: 'Dejar así' }).focus()
  await userEvent.keyboard('{Enter}')
  expect(onSubmit).toHaveBeenCalledTimes(1)
})

test('submitting does not navigate: the default of the form is prevented', () => {
  render(<StepSubmit onSubmit={() => {}}>Seguir</StepSubmit>)
  const form = screen.getByRole('button', { name: 'Seguir' }).closest('form')
  const event = new Event('submit', { bubbles: true, cancelable: true })
  form?.dispatchEvent(event)
  expect(event.defaultPrevented).toBe(true)
})

test('the secondary variant is still a named submit', () => {
  render(
    <StepSubmit onSubmit={() => {}} variant="secondary">
      Dejar así
    </StepSubmit>,
  )
  expect(screen.getByRole('button', { name: 'Dejar así' })).toHaveAttribute('type', 'submit')
})
