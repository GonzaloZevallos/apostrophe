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
import { type FixedSet, HOME_PERIODS, SALES_PERIODS } from './fixedSets'
import Pestanas from './Pestanas'

/** The shown name of one option of a registry set, read the way the tab reads it. */
function nameOf<T extends string>(set: FixedSet<T>, value: T): string {
  const option = set.find((candidate) => candidate.value === value)
  if (option === undefined) throw new Error(`no option ${value}`)
  return option.label()
}

const TODAY = nameOf(HOME_PERIODS, 'today')
const WEEK = nameOf(HOME_PERIODS, 'week')
const MONTH = nameOf(HOME_PERIODS, 'month')
const DATES = nameOf(SALES_PERIODS, 'fechas')

test('the active tab carries aria-pressed true, the other false', () => {
  render(<Pestanas items={HOME_PERIODS} value="week" onChange={() => {}} ariaLabel="Period" />)
  expect(screen.getByRole('button', { name: TODAY })).toHaveAttribute('aria-pressed', 'false')
  expect(screen.getByRole('button', { name: WEEK })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: MONTH })).toHaveAttribute('aria-pressed', 'false')
})

test('clicking a tab reports its own value', async () => {
  const onChange = vi.fn()
  render(<Pestanas items={HOME_PERIODS} value="week" onChange={onChange} ariaLabel="Period" />)

  await userEvent.click(screen.getByRole('button', { name: TODAY }))

  expect(onChange).toHaveBeenCalledWith('today')
})

test('every tab carries boton--enlace, Boton\'s own border/background reset, never its own', () => {
  // Review finding (blocking): "no class outside Boton's own may set border or
  // background." `Pestanas` draws its tab shape over `.boton--enlace` (one of
  // `Boton`'s five classes) and only adds colour/weight/underline on top.
  render(<Pestanas items={HOME_PERIODS} value="week" onChange={() => {}} ariaLabel="Period" />)
  for (const button of screen.getAllByRole('button')) {
    expect(button.className.split(' ')).toContain('boton--enlace')
  }
})

test('without ajuste the output carries no celdas class and no inner grid', () => {
  const { container } = render(
    <Pestanas items={SALES_PERIODS} value="hoy" onChange={() => {}} ariaLabel="Period" />,
  )
  const group = screen.getByRole('group', { name: 'Period' })
  expect(group.className).toBe('pestanas')
  expect(container.querySelector('.pestanas__celdas')).toBeNull()
  expect(group.children).toHaveLength(4)
})

test('with ajuste celdas the group gets the celdas class and every label stays whole', () => {
  render(
    <Pestanas items={SALES_PERIODS} value="mes" onChange={() => {}} ariaLabel="Period" ajuste="celdas" />,
  )
  const group = screen.getByRole('group', { name: 'Period' })
  expect(group.className.split(' ')).toContain('pestanas--celdas')
  for (const option of SALES_PERIODS) {
    const name = option.label()
    expect(screen.getByRole('button', { name })).toHaveTextContent(name)
  }
})

test('with ajuste celdas aria-pressed and onChange behave as without it', async () => {
  const onChange = vi.fn()
  render(
    <Pestanas items={SALES_PERIODS} value="mes" onChange={onChange} ariaLabel="Period" ajuste="celdas" />,
  )
  expect(screen.getByRole('button', { name: MONTH })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: TODAY })).toHaveAttribute('aria-pressed', 'false')

  await userEvent.click(screen.getByRole('button', { name: DATES }))

  expect(onChange).toHaveBeenCalledWith('fechas')
})
