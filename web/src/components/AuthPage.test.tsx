import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import AuthPage from './AuthPage'

test('shows the title as a heading, the subtitle and its children in one page', () => {
  render(
    <AuthPage title="Elegí algo" subtitle="Una aclaración">
      <button type="button">Seguir</button>
    </AuthPage>,
  )

  expect(screen.getByRole('heading', { name: 'Elegí algo' })).toBeInTheDocument()
  expect(screen.getByText('Una aclaración')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Seguir' })).toBeInTheDocument()
})

test('draws no heading and no subtitle when it is given none', () => {
  render(
    <AuthPage>
      <span>Adentro</span>
    </AuthPage>,
  )

  expect(screen.queryByRole('heading')).not.toBeInTheDocument()
  expect(screen.getByText('Adentro')).toBeInTheDocument()
})
