import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import FieldRefusal from './FieldRefusal'

test('the refusal is an alert whose name is the sentence, with a hidden Attention icon beside it', () => {
  render(<FieldRefusal id="refusal">Choose how they paid.</FieldRefusal>)
  const alert = screen.getByRole('alert')
  expect(alert).toHaveTextContent('Choose how they paid.')
  expect(alert).toHaveAttribute('id', 'refusal')
  expect(alert.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
})
