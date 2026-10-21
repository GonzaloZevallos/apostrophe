import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import ConfirmDialog from './ConfirmDialog'

test('shows the title and detail, and confirms or cancels through its callbacks', async () => {
  const user = userEvent.setup()
  const onConfirm = vi.fn()
  const onCancel = vi.fn()
  render(
    <ConfirmDialog
      title="¿Borrás el precio from 25/09?"
      detail="Back to $ 9.000 x g from 12/09"
      confirmText="Yes, delete it"
      cancelText="No, keep it"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />,
  )

  expect(screen.getByText('¿Borrás el precio from 25/09?')).toBeInTheDocument()
  expect(screen.getByText('Back to $ 9.000 x g from 12/09')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'No, keep it' }))
  expect(onCancel).toHaveBeenCalledOnce()
  expect(onConfirm).not.toHaveBeenCalled()

  await user.click(screen.getByRole('button', { name: 'Yes, delete it' }))
  expect(onConfirm).toHaveBeenCalledOnce()
})
