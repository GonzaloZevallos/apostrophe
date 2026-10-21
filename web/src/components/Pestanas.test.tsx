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
  { value: 'hoy', label: 'Today' },
  { value: 'semana', label: 'Week' },
] as const

test('the active tab carries aria-pressed true, the other false', () => {
  render(<Pestanas items={ITEMS} value="semana" onChange={() => {}} ariaLabel="Period" />)
  expect(screen.getByRole('button', { name: 'Today' })).toHaveAttribute('aria-pressed', 'false')
  expect(screen.getByRole('button', { name: 'Week' })).toHaveAttribute('aria-pressed', 'true')
})

test('clicking a tab reports its own value', async () => {
  const onChange = vi.fn()
  render(<Pestanas items={ITEMS} value="semana" onChange={onChange} ariaLabel="Period" />)

  await userEvent.click(screen.getByRole('button', { name: 'Today' }))

  expect(onChange).toHaveBeenCalledWith('hoy')
})

test('every tab carries boton--enlace, Boton\'s own border/background reset, never its own', () => {
  // Review finding (blocking): "no class outside Boton's own may set border or
  // background." `Pestanas` draws its tab shape over `.boton--enlace` (one of
  // `Boton`'s five classes) and only adds colour/weight/underline on top.
  render(<Pestanas items={ITEMS} value="semana" onChange={() => {}} ariaLabel="Period" />)
  for (const button of screen.getAllByRole('button')) {
    expect(button.className.split(' ')).toContain('boton--enlace')
  }
})

const FOUR = [
  { value: 'hoy', label: 'Today' },
  { value: 'semana', label: 'Week' },
  { value: 'mes', label: 'Month' },
  { value: 'fechas', label: 'Fechas' },
] as const

test('without ajuste the output carries no celdas class and no inner grid', () => {
  const { container } = render(
    <Pestanas items={FOUR} value="hoy" onChange={() => {}} ariaLabel="Period" />,
  )
  const group = screen.getByRole('group', { name: 'Period' })
  expect(group.className).toBe('pestanas')
  expect(container.querySelector('.pestanas__celdas')).toBeNull()
  expect(group.children).toHaveLength(4)
})

test('with ajuste celdas the group gets the celdas class and every label stays whole', () => {
  render(
    <Pestanas items={FOUR} value="mes" onChange={() => {}} ariaLabel="Period" ajuste="celdas" />,
  )
  const group = screen.getByRole('group', { name: 'Period' })
  expect(group.className.split(' ')).toContain('pestanas--celdas')
  for (const name of ['Today', 'Week', 'Month', 'Fechas']) {
    expect(screen.getByRole('button', { name })).toHaveTextContent(name)
  }
})

test('with ajuste celdas aria-pressed and onChange behave as without it', async () => {
  const onChange = vi.fn()
  render(
    <Pestanas items={FOUR} value="mes" onChange={onChange} ariaLabel="Period" ajuste="celdas" />,
  )
  expect(screen.getByRole('button', { name: 'Month' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: 'Today' })).toHaveAttribute('aria-pressed', 'false')

  await userEvent.click(screen.getByRole('button', { name: 'Fechas' }))

  expect(onChange).toHaveBeenCalledWith('fechas')
})
