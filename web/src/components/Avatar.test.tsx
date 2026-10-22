import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import Avatar from './Avatar'

test('shows the name\'s initials, hidden from assistive technology', () => {
  const { container } = render(<Avatar name="Nico Parra" />)
  const avatar = container.querySelector('.avatar')
  expect(avatar).toHaveTextContent('NP')
  expect(avatar).toHaveAttribute('aria-hidden', 'true')
})

test('is absent from the accessible tree', () => {
  render(
    <a href="/c/1">
      <Avatar name="Nico Parra" />
      Nico Parra
    </a>,
  )
  expect(screen.getByRole('link')).toHaveAccessibleName('Nico Parra')
})
