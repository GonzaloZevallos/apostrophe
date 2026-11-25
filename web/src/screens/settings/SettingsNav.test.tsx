/**
 * `SettingsNav`'s two additions to the phone list, through what the person sees: the row marked
 * by `activeKey` (`aria-current="page"` and the modifier class, never a shortcut) and the Business
 * card that precedes the list when `card` is given. Names come from the registry and the copy.
 * The list itself is covered by `SettingsHomeList.test.tsx`.
 */

import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { expect, test } from 'vitest'
import { testT } from '../../i18n/testing'
import SettingsNav from './SettingsNav'
import { SETTINGS_ROWS, SHORTCUTS, type SettingsRowContext, type SettingsRowKey } from './settingsRows'

const HOME = '/home-under-test'
const CTX: SettingsRowContext = { selectableLanguages: ['en'], isCustomerTypesOn: true }
const MARKER = 'ajustes-inicio__fila--actual'

function renderNav(props: Partial<Parameters<typeof SettingsNav>[0]> = {}) {
  const router = createMemoryRouter([{ path: HOME, element: <SettingsNav ctx={CTX} {...props} /> }], {
    initialEntries: [HOME],
  })
  return render(<RouterProvider router={router} />)
}

function rowName(rowKey: SettingsRowKey): string {
  const row = SETTINGS_ROWS.find((candidate) => candidate.key === rowKey)
  if (row === undefined) throw new Error(`no row ${rowKey}`)
  return `${testT(row.labelKey)} ${testT(row.descriptionKey)}`
}

test('activeKey marks exactly one link, the row and not the shortcut that shares its address', async () => {
  renderNav({ activeKey: 'paymentMethods' })
  await screen.findAllByRole('heading', { level: 2 })

  const marked = screen.getAllByRole('link', { current: 'page' })

  expect(marked).toHaveLength(1)
  expect(marked[0]).toBe(screen.getByRole('link', { name: rowName('paymentMethods') }))
  expect(marked[0]).toHaveClass(MARKER)
  for (const shortcut of SHORTCUTS) {
    const link = screen.getByRole('link', { name: testT(shortcut.labelKey) })
    expect(link).not.toHaveAttribute('aria-current')
    expect(link).not.toHaveClass(MARKER)
  }
})

test('a key with no shown row marks nothing', async () => {
  renderNav({ activeKey: 'language' })
  await screen.findAllByRole('heading', { level: 2 })

  expect(screen.queryByRole('link', { current: 'page' })).not.toBeInTheDocument()
})

test('with no activeKey no link carries aria-current or the marker', async () => {
  renderNav()
  await screen.findAllByRole('heading', { level: 2 })

  for (const link of screen.getAllByRole('link')) {
    expect(link).not.toHaveAttribute('aria-current')
    expect(link).not.toHaveClass(MARKER)
  }
})

test('the card comes before the list when given, with the count slot filled', async () => {
  renderNav({ card: { businessName: 'La Huerta', userCount: 3 } })

  const name = await screen.findByText('La Huerta')
  const firstShortcut = screen.getByRole('link', { name: testT(SHORTCUTS[0].labelKey) })

  expect(name.compareDocumentPosition(firstShortcut) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(screen.getByText(testT('settings:card.users', { count: 3 }))).toBeInTheDocument()
})

test('with no card there is no business name on the page', async () => {
  renderNav()
  await screen.findAllByRole('heading', { level: 2 })

  expect(screen.queryByText('La Huerta')).not.toBeInTheDocument()
})
