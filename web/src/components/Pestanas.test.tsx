/**
 * `Pestanas` at the component seam (CODING_STANDARDS §10, §5): Testing Library.
 * Clicking an inactive tab reports its own value, and the active tab carries
 * `aria-pressed="true"` — the exact gap the review flagged in the sibling
 * `SelectorPago.test.tsx` ("no test clicks an enabled option and checks that
 * onChange receives its value"), not repeated here.
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import Pestanas from './Pestanas'

const ITEMS = [
  { value: 'hoy', label: 'Hoy' },
  { value: 'semana', label: 'Semana' },
] as const

test('the active tab carries aria-pressed true, the other false', () => {
  render(<Pestanas items={ITEMS} value="semana" onChange={() => {}} ariaLabel="Período" />)
  expect(screen.getByRole('button', { name: 'Hoy' })).toHaveAttribute('aria-pressed', 'false')
  expect(screen.getByRole('button', { name: 'Semana' })).toHaveAttribute('aria-pressed', 'true')
})

test('clicking a tab reports its own value', async () => {
  const onChange = vi.fn()
  render(<Pestanas items={ITEMS} value="semana" onChange={onChange} ariaLabel="Período" />)

  await userEvent.click(screen.getByRole('button', { name: 'Hoy' }))

  expect(onChange).toHaveBeenCalledWith('hoy')
})

test('every tab carries boton--enlace, Boton\'s own border/background reset, never its own', () => {
  // Review finding (blocking): "no class outside Boton's own may set border or
  // background." `Pestanas` draws its tab shape over `.boton--enlace` (one of
  // `Boton`'s five classes) and only adds colour/weight/underline on top.
  render(<Pestanas items={ITEMS} value="semana" onChange={() => {}} ariaLabel="Período" />)
  for (const button of screen.getAllByRole('button')) {
    expect(button.className.split(' ')).toContain('boton--enlace')
  }
})
