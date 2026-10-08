import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'
import MasInfo from './MasInfo'

const LINE = 'Tu chat propio recibe las pruebas.'
const MORE = 'El bot escribe a tu chat para avisarte que anda.'

test('it mounts closed, opens on a tap and collapses on a second', async () => {
  const user = userEvent.setup()
  render(<MasInfo line={LINE} more={MORE} />)

  const button = screen.getByRole('button', { name: 'Más info' })
  expect(button).toHaveAttribute('aria-expanded', 'false')
  expect(screen.getByText(LINE)).toBeVisible()
  expect(screen.getByText(MORE)).not.toBeVisible()

  await user.click(button)
  expect(button).toHaveAttribute('aria-expanded', 'true')
  expect(screen.getByText(MORE)).toBeVisible()

  await user.click(button)
  expect(button).toHaveAttribute('aria-expanded', 'false')
  expect(screen.getByText(MORE)).not.toBeVisible()
})

test('the open state is local: a remount is closed and nothing is stored or pushed', async () => {
  const user = userEvent.setup()
  const before = window.history.length
  const { unmount } = render(<MasInfo line={LINE} more={MORE} />)
  await user.click(screen.getByRole('button', { name: 'Más info' }))
  unmount()

  render(<MasInfo line={LINE} more={MORE} />)
  expect(screen.getByRole('button', { name: 'Más info' })).toHaveAttribute('aria-expanded', 'false')
  expect(window.localStorage.length).toBe(0)
  expect(window.sessionStorage.length).toBe(0)
  expect(window.history.length).toBe(before)
})

test('the "i" icon is hidden from assistive technology and the name stays "Más info"', () => {
  const { container } = render(<MasInfo line={LINE} more={MORE} />)
  expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  expect(screen.getByRole('button')).toHaveAccessibleName('Más info')
})
