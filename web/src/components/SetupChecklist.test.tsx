/**
 * `SetupChecklist` (plan C, "SetupChecklist component (Testing Library)"): renders the
 * server's steps in the order given, never filtering or reordering them (plan
 * invariant 7), with the copy and destinations from `results.md`.
 */

import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { expect, test } from 'vitest'
import panelFixture from '../api/fixtures/panel.json'
import type { PanelAnswer, SetupStep } from '../api/panel'
import SetupChecklist from './SetupChecklist'
import { STEP_COPY } from './setupSteps'

const FIXTURE_STEPS: SetupStep[] = (panelFixture as PanelAnswer).setup.checklist?.steps ?? []

function renderChecklist(steps: SetupStep[]) {
  return render(
    <MemoryRouter>
      <SetupChecklist steps={steps} />
    </MemoryRouter>,
  )
}

test('shows the heading and each step as a link with its label and destination', () => {
  renderChecklist(FIXTURE_STEPS)

  expect(screen.getByRole('heading', { name: 'Para empezar a vender' })).toBeInTheDocument()
  const expected: Array<[string, string]> = [
    ['Cargá una variedad con su precio', '/variedades'],
    ['Cargá tu stock inicial', '/mi-stock/nueva-entrada'],
    ['Conectá el bot de Telegram', '/catalogo'],
    ['Invitá a un socio', '/negocio'],
  ]
  for (const [label, to] of expected) {
    expect(screen.getByRole('link', { name: new RegExp(label) })).toHaveAttribute('href', to)
  }
})

test('a done step shows its box ticked and the word "Hecho"; a pending one shows neither', () => {
  renderChecklist(FIXTURE_STEPS)

  const done = screen.getByRole('link', {
    name: /Cargá una variedad con su precio/,
  })
  expect(within(done).getByText('Hecho')).toBeInTheDocument()
  expect(done.querySelector('.paso-inicial__caja--hecha')).not.toBeNull()

  const pending = screen.getByRole('link', { name: /Cargá tu stock inicial/ })
  expect(within(pending).queryByText('Hecho')).toBeNull()
  expect(pending.querySelector('.paso-inicial__caja')).not.toBeNull()
  expect(pending.querySelector('.paso-inicial__caja--hecha')).toBeNull()
})

test('"Opcional" is driven by required, never by the step', () => {
  renderChecklist([
    { step: 'partner', done: false, required: true },
    { step: 'priced_variety', done: false, required: false },
  ])

  const partner = screen.getByRole('link', { name: /Invitá a un socio/ })
  const priced = screen.getByRole('link', {
    name: /Cargá una variedad con su precio/,
  })
  expect(within(partner).queryByText('Opcional')).toBeNull()
  expect(within(priced).getByText('Opcional')).toBeInTheDocument()
})

test('renders the steps in the order given and shows only the steps given', () => {
  renderChecklist([
    { step: 'partner', done: false, required: false },
    { step: 'stock_entry', done: true, required: true },
  ])

  const links = screen.getAllByRole('link')
  expect(links.map((l) => l.getAttribute('href'))).toEqual(['/negocio', '/mi-stock/nueva-entrada'])
})

test("the server's step ids are exactly the copy's keys", () => {
  expect(FIXTURE_STEPS.map((s) => s.step).sort()).toEqual(Object.keys(STEP_COPY).sort())
})
