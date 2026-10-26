/**
 * The withdrawal form as a sheet, at the route seam: Testing Library through the real data router,
 * `fetch` faked. On a phone a direct address to the new withdrawal shows the sheet over Varieties,
 * and to the edit shows it over the withdrawal's detail (an inert, hidden `BehindPane`); the first
 * control is the reason's first option, there is exactly one Close, and the errors and the main
 * action sit in the pinned actions with nothing below them (ADR-0053). Opened from inside the app
 * no pane is drawn: the screen it was opened from is the one the app already has behind it.
 */

import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import WITHDRAWAL_FIXTURE from '../../api/fixtures/withdrawal.json'
import { COMMON_TEXT } from '../../copy/common'
import { STOCK_TEXT } from '../../copy/stock'
import { VARIETIES, WITHDRAWAL_EDIT, WITHDRAWAL_NEW, pathTo } from '../../routes'
import { flipViewport, stubViewport } from '../../test-viewport'
import { behindPane, expectBehindPane, expectBehindPaneEmpty } from '../../test/behindPane'
import { jsonResponse, renderWithdrawals } from './renderWithdrawals'

afterEach(() => {
  vi.unstubAllGlobals()
})

const STOCK_WITH_ROWS = {
  total: 20,
  varieties: [{ variety_id: 1, grams: 20, status: 'ok', sold_out_since: null, threshold: null, days_left: 30 }],
  entries: [],
}
const EDIT = pathTo(WITHDRAWAL_EDIT, { id: WITHDRAWAL_FIXTURE.id })

function withdrawalApi(read: () => Promise<Response> = async () => jsonResponse(200, WITHDRAWAL_FIXTURE)) {
  return async (url: string): Promise<Response> => {
    if (url === `/stock/withdrawals/${WITHDRAWAL_FIXTURE.id}`) return read()
    return jsonResponse(404, {})
  }
}

test('a direct address to the new withdrawal shows the sheet over Varieties, focus on the first reason, one Close', async () => {
  renderWithdrawals([WITHDRAWAL_NEW], withdrawalApi(), undefined, STOCK_WITH_ROWS)

  const dialog = await screen.findByRole('dialog', { name: COMMON_TEXT.takeFromStock })
  expect(dialog).toHaveAttribute('aria-modal', 'true')
  await waitFor(() => expect(screen.getByRole('button', { name: 'Promotion' })).toHaveFocus())
  expect(screen.getAllByRole('button', { name: COMMON_TEXT.close })).toHaveLength(1)
  expect(within(dialog).getByRole('button', { name: COMMON_TEXT.close })).toBeInTheDocument()

  const actions = document.querySelector('.sheet__actions')
  expect(actions).toContainElement(screen.getByRole('button', { name: STOCK_TEXT.guardaElRetiro }))
  // The form's own element is the actions' parent, and the main action is its last child.
  expect(actions?.parentElement?.tagName).toBe('FORM')
  expect(actions?.nextElementSibling).toBeNull()
  expect(actions?.lastElementChild).toBe(screen.getByRole('button', { name: STOCK_TEXT.guardaElRetiro }))

  const pane = behindPane()
  expectBehindPane(pane)
  await waitFor(() => expect(pane).toHaveTextContent('Zkittlez'))
  expect(pane).not.toContainElement(dialog)
  // Loaded, the pane still holds no id, no heading and no busy mark.
  expectBehindPane(pane)
})

test('a direct address to the edit shows the sheet over the withdrawal, focus on the first reason, one Close', async () => {
  renderWithdrawals([EDIT], withdrawalApi())

  const dialog = await screen.findByRole('dialog', { name: COMMON_TEXT.takeFromStock })
  await waitFor(() => expect(screen.getByRole('button', { name: 'Promotion' })).toHaveFocus())
  expect(screen.getAllByRole('button', { name: COMMON_TEXT.close })).toHaveLength(1)
  expect(document.querySelector('.sheet__actions')).toContainElement(
    screen.getByRole('button', { name: COMMON_TEXT.save }),
  )

  const pane = behindPane()
  expectBehindPane(pane)
  await waitFor(() => expect(pane).toHaveTextContent(WITHDRAWAL_FIXTURE.note))
  expect(pane).toHaveTextContent('Zkittlez')
  // A picture of the detail: nothing in it acts, and the detail's own actions are left out.
  expect(pane.querySelector('button, a')).toBeNull()
  expect(pane).not.toContainElement(dialog)
  // After the form's data arrived the pane is still free of ids, headings and busy marks.
  expectBehindPane(pane)
})

test('while the withdrawal is pending only the loading frame is drawn, with no pane', async () => {
  renderWithdrawals([EDIT], withdrawalApi(() => new Promise<Response>(() => undefined)))

  await waitFor(() => expect(document.querySelector('.pantalla')).not.toBeNull())
  expect(document.querySelector('.behind-pane')).toBeNull()
})

test('when the withdrawal fails to load the form shows its own error and draws no pane', async () => {
  renderWithdrawals([EDIT], withdrawalApi(async () => jsonResponse(500, {})))

  await screen.findByRole('alert')
  expect(document.querySelector('.behind-pane')).toBeNull()
})

test('on the new withdrawal a failing Varieties list leaves the pane empty', async () => {
  renderWithdrawals([WITHDRAWAL_NEW], withdrawalApi(), async () => jsonResponse(500, {}))

  await new Promise((resolve) => setTimeout(resolve, 30))
  expectBehindPaneEmpty(behindPane())
})

test('opened from inside the app no pane is drawn', async () => {
  const { router } = renderWithdrawals([VARIETIES], withdrawalApi())
  await userEvent.click(await screen.findByRole('link', { name: 'Take from stock' }))

  await screen.findByRole('dialog', { name: COMMON_TEXT.takeFromStock })
  expect(router.state.location.pathname).toBe(WITHDRAWAL_NEW)
  expect(document.querySelector('.behind-pane')).toBeNull()
})

test('on a computer there is no sheet and no pane', async () => {
  stubViewport('computer')
  renderWithdrawals([WITHDRAWAL_NEW], withdrawalApi())

  await screen.findByRole('button', { name: 'Promotion' })
  expect(document.querySelector('.sheet')).toBeNull()
  expect(document.querySelector('.behind-pane')).toBeNull()
  expect(document.querySelector('.sheet__actions')).toBeNull()
})

test('a flip across 900 px keeps what was typed', async () => {
  stubViewport('phone')
  renderWithdrawals([WITHDRAWAL_NEW], withdrawalApi())
  const note = await screen.findByLabelText(COMMON_TEXT.note)
  await userEvent.type(note, 'Para la fiesta')

  flipViewport('computer')

  await waitFor(() => expect(document.querySelector('.sheet')).toBeNull())
  expect(screen.getByLabelText(COMMON_TEXT.note)).toBe(note)
  expect(note).toHaveValue('Para la fiesta')
})
