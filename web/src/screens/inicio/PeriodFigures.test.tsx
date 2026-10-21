/**
 * Semana's and Mes's figures on their own (Testing Library, no `fetch`): every figure is a
 * named group, in results.md's order, a missing withdrawal line is no group at all, a
 * negative Ganancia and Caja read "−$ X", and Hoy draws the headline with no figure group.
 */

import { render, screen, within } from '@testing-library/react'
import { expect, test } from 'vitest'
import panelFixture from '../../api/fixtures/panel.json'
import type { PanelAnswer, PanelPeriod } from '../../api/panel'
import PeriodPanel, { PeriodFigures } from './PeriodFigures'

const PANEL: PanelAnswer = panelFixture as PanelAnswer
const WEEK: PanelPeriod = PANEL.periods.week
const MONTH: PanelPeriod = PANEL.periods.month

const FIGURE_LABELS = [
  'Regalaste',
  'Costo de lo vendido',
  'Faltante de stock',
  'Promoción',
  'Consumo propio',
  'Expenses',
  'Flower purchases',
  'Profit',
  'Cash',
]

/** The names of the figure groups on screen, in document order, from the closed list of
 * figure labels. */
function figureNames(): string[] {
  return screen
    .getAllByRole('group')
    .map((node) => node.getAttribute('aria-labelledby'))
    .map((id) => (id === null ? '' : (document.getElementById(id)?.textContent ?? '')))
    .filter((name) => FIGURE_LABELS.includes(name))
}

test('Semana draws the seven list figures in results.md order, then Ganancia and Caja', () => {
  render(<PeriodFigures tab="week" period={WEEK} />)

  expect(figureNames()).toEqual(FIGURE_LABELS)
  const gastos = screen.getByRole('group', { name: 'Expenses' })
  expect(within(gastos).getByText('$ 12.000')).toBeInTheDocument()
  expect(within(screen.getByRole('group', { name: 'Regalaste' })).getByText('2 g')).toBeInTheDocument()
})

test('a withdrawal line the period does not have is no group, never a $ 0 one', () => {
  render(<PeriodFigures tab="month" period={MONTH} />)

  expect(figureNames()).toEqual([
    'Regalaste',
    'Costo de lo vendido',
    'Expenses',
    'Flower purchases',
    'Profit',
    'Cash',
  ])
  for (const label of ['Faltante de stock', 'Promoción', 'Consumo propio']) {
    expect(screen.queryByRole('group', { name: label })).toBeNull()
  }
})

test('each pending note sits inside the group it qualifies, and never inside Caja', () => {
  render(<PeriodFigures tab="week" period={{ ...WEEK, pending_cost: true }} />)

  const note = 'incluye costo pendiente'
  const withNote = ['Costo de lo vendido', 'Faltante de stock', 'Promoción', 'Profit']
  for (const label of FIGURE_LABELS) {
    const group = screen.getByRole('group', { name: label })
    if (withNote.includes(label)) expect(within(group).getByText(note)).toBeInTheDocument()
    else expect(within(group).queryByText(note)).toBeNull()
  }
  expect(screen.getAllByText(note)).toHaveLength(withNote.length)
})

test('a negative Ganancia and Caja read "−$ X", and Ganancia keeps its accent', () => {
  render(<PeriodFigures tab="week" period={{ ...WEEK, profit: -5000, cash: -12000 }} />)

  const ganancia = within(screen.getByRole('group', { name: 'Profit' })).getByText('−$ 5.000')
  expect(ganancia).toHaveClass('panel-resultados__valor--acento')
  const caja = within(screen.getByRole('group', { name: 'Cash' })).getByText('−$ 12.000')
  expect(caja).not.toHaveClass('panel-resultados__valor--acento')
})

test('the periods wrapper carries the figures modifier on Semana and Mes, never on Hoy', () => {
  const { container, rerender } = render(<PeriodPanel tab="today" period={PANEL.periods.today} />)
  expect(container.querySelector('.panel-periodo')).not.toBeNull()
  expect(container.querySelector('.panel-periodo--con-cifras')).toBeNull()
  expect(container.querySelector('.panel-cifras')).toBeNull()
  expect(screen.getByText('Vendiste hoy')).toBeInTheDocument()
  expect(screen.queryAllByRole('group')).toHaveLength(0)

  rerender(<PeriodPanel tab="week" period={WEEK} />)
  expect(container.querySelector('.panel-periodo--con-cifras')).not.toBeNull()
  expect(screen.getByText('Vendiste esta semana')).toBeInTheDocument()

  rerender(<PeriodPanel tab="month" period={MONTH} />)
  expect(container.querySelector('.panel-periodo--con-cifras')).not.toBeNull()
  expect(screen.getByText('Vendiste este mes')).toBeInTheDocument()
})

test('two instances together: every aria-labelledby resolves to exactly one element, and no id repeats', () => {
  render(
    <>
      <PeriodFigures tab="week" period={WEEK} />
      <PeriodFigures tab="month" period={MONTH} />
    </>,
  )

  const groups = screen.getAllByRole('group')
  const ids = groups.map((group) => group.getAttribute('aria-labelledby'))
  expect(ids).toHaveLength(9 + 6)
  expect(new Set(ids).size).toBe(ids.length)
  for (const id of ids) {
    expect(id).not.toBeNull()
    expect(document.querySelectorAll(`[id="${id}"]`)).toHaveLength(1)
  }
})

/** The value span of a figure group: the one that carries the formatted figure. */
function valueOf(label: string, text: string): HTMLElement {
  return within(screen.getByRole('group', { name: label })).getByText(text)
}

test('data-largo carries the length of the formatted figure, 8 to 14, and is absent below 8', () => {
  render(<PeriodFigures tab="week" period={{ ...WEEK, expenses: 93000, purchases: 9000 }} />)

  expect(valueOf('Expenses', '$ 93.000')).toHaveAttribute('data-largo', '8')
  expect(valueOf('Flower purchases', '$ 9.000')).not.toHaveAttribute('data-largo')
  expect(valueOf('Regalaste', '2 g')).not.toHaveAttribute('data-largo')
})

test('data-largo is 14 for "−$ 999.999.999" and stays 14 for anything longer', () => {
  render(
    <PeriodFigures
      tab="week"
      period={{ ...WEEK, profit: -999999999, cash: 1000000000, cost_of_goods: 12345678 }}
    />,
  )

  expect(valueOf('Profit', '−$ 999.999.999')).toHaveAttribute('data-largo', '14')
  expect(valueOf('Cash', '$ 1.000.000.000')).toHaveAttribute('data-largo', '14')
  expect(valueOf('Costo de lo vendido', '$ 12.345.678')).toHaveAttribute('data-largo', '12')
})

test('data-largo counts the sign as the character it is, and says nothing else', () => {
  render(<PeriodFigures tab="week" period={{ ...WEEK, profit: -5000, cash: 5000 }} />)

  expect(valueOf('Profit', '−$ 5.000')).toHaveAttribute('data-largo', '8')
  expect(valueOf('Cash', '$ 5.000')).not.toHaveAttribute('data-largo')
})
