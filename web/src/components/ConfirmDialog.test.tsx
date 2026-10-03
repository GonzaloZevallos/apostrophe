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
      title="¿Borrás el precio desde el 25/09?"
      detail="Vuelve a regir $ 9.000 x g desde el 12/09"
      confirmText="Sí, borralo"
      cancelText="No, dejalo"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />,
  )

  expect(screen.getByText('¿Borrás el precio desde el 25/09?')).toBeInTheDocument()
  expect(screen.getByText('Vuelve a regir $ 9.000 x g desde el 12/09')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'No, dejalo' }))
  expect(onCancel).toHaveBeenCalledOnce()
  expect(onConfirm).not.toHaveBeenCalled()

  await user.click(screen.getByRole('button', { name: 'Sí, borralo' }))
  expect(onConfirm).toHaveBeenCalledOnce()
})
