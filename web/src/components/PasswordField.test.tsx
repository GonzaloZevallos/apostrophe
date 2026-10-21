import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { expect, test } from 'vitest'
import PasswordField from './PasswordField'

function Harness({ error }: { error?: string | null }) {
  const [value, setValue] = useState('')
  return <PasswordField label="New password" value={value} onChange={setValue} error={error} />
}

test('hides the password until Mostrar is pressed, and Ocultar hides it again', async () => {
  const user = userEvent.setup()
  render(<Harness />)

  const input = screen.getByLabelText('New password')
  expect(input).toHaveAttribute('type', 'password')

  await user.click(screen.getByRole('button', { name: 'Show' }))
  expect(input).toHaveAttribute('type', 'text')

  await user.click(screen.getByRole('button', { name: 'Hide' }))
  expect(input).toHaveAttribute('type', 'password')
})

test('reports what is typed through onChange', async () => {
  const user = userEvent.setup()
  render(<Harness />)

  await user.type(screen.getByLabelText('New password'), 'abc')

  expect(screen.getByLabelText('New password')).toHaveValue('abc')
})

test('shows the error inline as an alert, and no alert without one', () => {
  const { rerender } = render(<Harness />)
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()

  rerender(<Harness error="Muy corta" />)
  expect(screen.getByRole('alert')).toHaveTextContent('Muy corta')
})
