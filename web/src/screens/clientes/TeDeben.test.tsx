/**
 * `TeDeben`, the section on top of Clientes, at the component seam (CODING_STANDARDS §10): Testing Library,
 * handed the answered debtors read as Clientes does. The list is the API's own order (plan, "Front": "the API's order"),
 * never resorted here; the total and count head the view and come from
 * `GET /payments/debtors` alone (payments.md, "Quién debe y los totales").
 */

import { CUSTOMER, CUSTOMERS } from '../../routes'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { expect, test } from 'vitest'
import TeDeben from './TeDeben'
import { baselineText } from '../../i18n/testing'
import { MoneyFormatProvider } from '../../format/MoneyFormatProvider'
import type { Debtors } from '../../api/payments'
import { debtorsOf, NO_DEBTORS } from '../../test/debtors'

const DEBTORS_FIXTURE = debtorsOf()

const NOBODY_OWES = baselineText('customers.ts:NOBODY_OWES')

function renderTeDeben(data: Debtors) {
  render(
    <MoneyFormatProvider format={{ symbol: '$', decimals: 0 }}>
      <MemoryRouter initialEntries={[CUSTOMERS]}>
        <Routes>
          <Route path={CUSTOMERS} element={<TeDeben data={data} />} />
          <Route path={CUSTOMER} element={<span>ficha</span>} />
        </Routes>
      </MemoryRouter>
    </MoneyFormatProvider>,
  )
}

test("heads with the total owed and lists debtors in the API's own order", () => {
  // `debtors.json` (plan, invariants: "used by the front's fetch fakes") holds one
  // debtor; a second is added here only to prove the API's own order is kept,
  // never resorted by this screen.
  renderTeDeben(
    debtorsOf({
      debtors: [
        ...DEBTORS_FIXTURE.debtors,
        { customer: { id: 2, name: 'Beto' }, balance: 22000, owing_since: '2026-09-20', standing: 'owes', still_owing: null },
      ],
    }),
  )

  expect(screen.getByText(`$ ${DEBTORS_FIXTURE.total_owed.toLocaleString('es-AR')}`)).toBeInTheDocument()

  const rows = screen
    .getAllByRole('link')
    .filter((link) => link.getAttribute('href')?.startsWith(`${CUSTOMERS}/`) && link.textContent !== 'Collect')
  expect(rows.map((row) => row.textContent)).toEqual([
    'APAna Pérez$ 15.000owes you since 14/09',
    'BEBeto$ 22.000owes you since 20/09',
  ])
  expect(screen.getAllByRole('link', { name: /^Collect from / }).map((link) => link.getAttribute('aria-label'))).toEqual([
    'Collect from Ana Pérez',
    'Collect from Beto',
  ])
})

test('the view carries no "N sales owing" line and no section header, whatever the count', () => {
  renderTeDeben(debtorsOf({ sales_owing_count: 3 }))

  screen.getByText(`$ ${DEBTORS_FIXTURE.total_owed.toLocaleString('es-AR')}`)
  expect(screen.queryByText(/sales? owing/)).not.toBeInTheDocument()
  expect(screen.queryByText('Owed to you')).not.toBeInTheDocument()
})

test('the debtor rows sit in a focusable place marked for the return to place', () => {
  renderTeDeben(DEBTORS_FIXTURE)

  const first = screen.getAllByRole('link', { name: /Ana Pérez/ })[0]!
  const place = first.closest('[data-place]')
  expect(place).toHaveAttribute('data-place', 'owed')
  expect(place).toHaveAttribute('tabindex', '-1')
})

test('nobody owing shows the fixed "Nobody owes you"', () => {
  renderTeDeben(NO_DEBTORS)

  const nobody = screen.getByText(NOBODY_OWES)
  expect(nobody).toHaveAttribute('data-place', 'owed')
  expect(nobody).toHaveAttribute('tabindex', '-1')
  expect(screen.queryByRole('link')).not.toBeInTheDocument()
  expect(screen.queryByText(/\$ /)).not.toBeInTheDocument()
})
