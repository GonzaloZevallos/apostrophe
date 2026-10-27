import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import AvisoExito from './AvisoExito'

test('announces the fixed toast text as a status, with no close or undo action', () => {
  render(<AvisoExito texto="Price saved" />)

  const status = screen.getByRole('status')
  expect(status).toHaveTextContent('Price saved')
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
})

test('resolves a common: toast key to its English text', () => {
  render(<AvisoExito texto="common:entryDeleted" />)

  expect(screen.getByRole('status')).toHaveTextContent('Entry deleted')
  expect(screen.queryByText('common:entryDeleted')).not.toBeInTheDocument()
})
