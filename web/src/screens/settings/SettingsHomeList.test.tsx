/**
 * `SettingsHomeList` through what the person sees: the three shortcuts, then the groups with
 * their shown rows, every entry one link that carries `enteredFrom: 'settings'`. The registry
 * (`settingsRows.ts`) is the oracle for names and addresses: nothing here repeats an address.
 * `ctx` is passed explicitly every time.
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { expect, test } from 'vitest'
import { testT } from '../../i18n/testing'
import SettingsHomeList from './SettingsHomeList'
import {
  SETTINGS_GROUP_LABEL_KEYS,
  SETTINGS_GROUPS,
  SETTINGS_ROWS,
  SHORTCUTS,
  shortcutTarget,
  type SettingsRow,
  type SettingsRowContext,
} from './settingsRows'

const HOME = '/home-under-test'

const ON_ONE: SettingsRowContext = { selectableLanguages: ['en'], isCustomerTypesOn: true }
const ON_TWO: SettingsRowContext = { selectableLanguages: ['en', 'es'], isCustomerTypesOn: true }

function renderList(ctx: SettingsRowContext, rows?: readonly SettingsRow[]) {
  const router = createMemoryRouter(
    [
      { path: HOME, element: <SettingsHomeList ctx={ctx} rows={rows} /> },
      { path: '*', element: <p>arrived</p> },
    ],
    { initialEntries: [HOME] },
  )
  render(<RouterProvider router={router} />)
  return router
}

/** Every link that is not a shortcut. */
function rowLinkCount(): number {
  return screen.getAllByRole('link').length - SHORTCUTS.length
}

function rowOf(rowKey: SettingsRow['key']): SettingsRow {
  const found = SETTINGS_ROWS.find((candidate) => candidate.key === rowKey)
  if (found === undefined) throw new Error(`no row ${rowKey}`)
  return found
}

function nameOf(candidate: SettingsRow): string {
  return `${testT(candidate.labelKey)} ${testT(candidate.descriptionKey)}`
}

test('shows five headings in group order, the shortcut strip before the first', async () => {
  renderList(ON_ONE)
  const headings = await screen.findAllByRole('heading', { level: 2 })
  expect(headings.map((heading) => heading.textContent)).toEqual(
    SETTINGS_GROUPS.map((group) => testT(SETTINGS_GROUP_LABEL_KEYS[group])),
  )
  const firstShortcut = screen.getByRole('link', { name: testT(SHORTCUTS[0].labelKey) })
  expect(firstShortcut.compareDocumentPosition(headings[0]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})

test('lists twelve rows with one language and thirteen with two', async () => {
  renderList(ON_ONE)
  await screen.findAllByRole('heading', { level: 2 })
  expect(rowLinkCount()).toBe(12)
  expect(screen.queryByRole('link', { name: nameOf(rowOf('language')) })).not.toBeInTheDocument()
})

test('with two languages the language row appears next to the business name, on the same address', async () => {
  renderList(ON_TWO)
  await screen.findAllByRole('heading', { level: 2 })
  expect(rowLinkCount()).toBe(13)
  const language = screen.getByRole('link', { name: nameOf(rowOf('language')) })
  const businessName = screen.getByRole('link', { name: nameOf(rowOf('businessName')) })
  expect(language).toHaveAttribute('href', rowOf('language').to)
  expect(businessName).toHaveAttribute('href', rowOf('businessName').to)
  expect(language.getAttribute('href')).toBe(businessName.getAttribute('href'))
})

test('the customer types row is missing while its switch is off or unknown', async () => {
  renderList({ ...ON_TWO, isCustomerTypesOn: false })
  await screen.findAllByRole('heading', { level: 2 })
  expect(rowLinkCount()).toBe(12)
  expect(screen.queryByRole('link', { name: nameOf(rowOf('customerTypes')) })).not.toBeInTheDocument()
})

test('every row link goes to its row address and is named by its label and second line', async () => {
  renderList(ON_TWO)
  await screen.findAllByRole('heading', { level: 2 })
  for (const candidate of SETTINGS_ROWS) {
    const link = screen.getByRole('link', { name: nameOf(candidate) })
    expect(link).toHaveAttribute('href', candidate.to)
  }
})

test('the three shortcuts are named by their label and go where the registry says', async () => {
  renderList(ON_ONE)
  await screen.findAllByRole('heading', { level: 2 })
  for (const shortcut of SHORTCUTS) {
    const link = screen.getByRole('link', { name: testT(shortcut.labelKey) })
    expect(link).toHaveAttribute('href', shortcutTarget(shortcut))
  }
})

test('every link, rows and shortcuts, arrives carrying enteredFrom settings', async () => {
  const user = userEvent.setup()
  const router = renderList(ON_TWO)
  await screen.findAllByRole('heading', { level: 2 })
  const total = screen.getAllByRole('link').length
  expect(total).toBe(SHORTCUTS.length + 13)

  for (let index = 0; index < total; index += 1) {
    await user.click(screen.getAllByRole('link')[index])
    const destination = router.state.location
    expect(destination.state).toMatchObject({ enteredFrom: 'settings' })
    await router.navigate(HOME)
    await screen.findAllByRole('heading', { level: 2 })
  }
})

test('a rows list without the catalog rows leaves out that heading and keeps the three shortcuts', async () => {
  const without = SETTINGS_ROWS.filter(
    (candidate) =>
      candidate.group !== 'catalog' &&
      candidate.key !== 'prices' &&
      candidate.key !== 'paymentMethods' &&
      candidate.key !== 'integrations',
  )
  renderList(ON_TWO, without)
  const headings = await screen.findAllByRole('heading', { level: 2 })
  expect(headings.map((heading) => heading.textContent)).toEqual(
    SETTINGS_GROUPS.filter((group) => group !== 'catalog').map((group) => testT(SETTINGS_GROUP_LABEL_KEYS[group])),
  )
  for (const shortcut of SHORTCUTS) {
    const link = screen.getByRole('link', { name: testT(shortcut.labelKey) })
    expect(link).toHaveAttribute('href', shortcutTarget(shortcut))
  }
})
