/**
 * `Shell` at the screen seam, under a memory *data* router: every screen of the registry is
 * mounted as a stub that only says its title, so what the shell draws is the registry's answer
 * for that screen's kind and place, and nothing else (no pathname, no history decides it).
 *
 * The bar is Inicio, Ventas, Clientes, Variedades and Más; the rail is the first four, a
 * divider, Gastos and Análisis, and the business row, with no Más. "+ Nueva venta" is fixed,
 * apart from the tabs, and only a root shows it. A card shows the bar and a "‹ parent" arrow,
 * a form neither. jsdom lays nothing out, so each surface is checked through its markup and
 * `useViewport` is mocked per case for the viewport (its own test owns `matchMedia`).
 */

import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, Outlet, RouterProvider, useLocation, type RouteObject } from 'react-router'
import { expect, test, vi } from 'vitest'
import type { Me } from '../api/me'
import InAppLink from '../components/InAppLink'
import {
  ANALYSIS,
  CUSTOMER,
  CUSTOMERS,
  EXPENSES,
  EXPENSE_NEW,
  HOME,
  MORE,
  SALE,
  SALE_NEW,
  SALES,
  SCREENS,
  SETTINGS,
  SETTINGS_USERS,
  VARIETIES,
  VARIETY,
  pathTo,
  type Screen,
} from '../routes'
import Mas from '../screens/Mas'
import Shell from './Shell'

const ME: Me = { email: 'ana@x.com', business_name: 'La Huerta', today: '2026-10-03' }

const BAR = ['Inicio', 'Ventas', 'Clientes', 'Variedades', 'Más']
const RAIL = ['Inicio', 'Ventas', 'Clientes', 'Variedades', 'Gastos', 'Análisis']

const viewport = vi.hoisted(() => ({ current: 'phone' as 'phone' | 'computer' }))

vi.mock('./useViewport', () => ({ useViewport: () => viewport.current }))

/** The tabs only, in the order they render: drops "Nueva venta" and the business row. */
function tabNames(nav: HTMLElement): string[] {
  return within(nav)
    .getAllByRole('link')
    .map((link) => link.textContent)
    .filter(
      (name): name is string =>
        name !== null && !name.startsWith('Nueva venta') && !name.startsWith('LH'),
    )
}

function Landed() {
  const location = useLocation()
  const inApp = (location.state as { inApp?: boolean } | null)?.inApp
  return <div>{`en ${location.pathname} inApp=${String(inApp)}`}</div>
}

/** A stand-in for Inicio's teaser: an in-app link into a customer's card. */
function Teaser() {
  return <InAppLink to={pathTo(CUSTOMER, { id: 3 })}>Cobrar a Ana</InAppLink>
}

/** Every registered screen as a leaf; Inicio holds the teaser, Más its real list. */
function leaf(entry: Screen): RouteObject {
  const element =
    entry.id === 'home' ? (
      <Teaser />
    ) : entry.id === 'more' ? (
      <Mas />
    ) : (
      <Landed />
    )
  return { path: entry.path, element, handle: { screen: entry.id } }
}

function renderShell(entries: string[], options: { computer?: boolean; index?: number } = {}) {
  viewport.current = options.computer === true ? 'computer' : 'phone'
  const router = createMemoryRouter(
    [{ element: <Outlet context={ME} />, children: [{ element: <Shell />, children: SCREENS.map(leaf) }] }],
    { initialEntries: entries, initialIndex: options.index ?? entries.length - 1 },
  )
  const view = render(<RouterProvider router={router} />)
  return { router, ...view }
}

function bar(container: HTMLElement): HTMLElement {
  return container.querySelector('.bar-inferior') as HTMLElement
}

function rail(container: HTMLElement): HTMLElement {
  return container.querySelector('.riel-lateral') as HTMLElement
}

/** The entries a surface marks as the current page. */
function current(nav: HTMLElement): string[] {
  return [...nav.querySelectorAll('[aria-current="page"]')].map((link) => link.textContent ?? '')
}

test('the bar is Inicio, Ventas, Clientes, Variedades and Más, with no Stock', () => {
  const { container } = renderShell([HOME])

  expect(container.querySelectorAll('nav')).toHaveLength(2)
  expect(tabNames(bar(container))).toEqual(BAR)
  expect(within(bar(container)).queryByText('Stock')).not.toBeInTheDocument()
})

test('every bar tab draws an icon and a visible label', () => {
  const { container } = renderShell([HOME])

  for (const link of within(bar(container)).getAllByRole('link')) {
    expect(link.querySelector('svg')).not.toBeNull()
    expect(link.querySelector('span')?.textContent).not.toBe('')
  }
})

test('the rail is "Nueva venta", four tabs, a divider, Gastos and Análisis, then the business row', () => {
  const { container } = renderShell([HOME], { computer: true })

  const entries = [...rail(container).children].map((child) =>
    child.getAttribute('role') === 'separator' ? '---' : (child.textContent ?? ''),
  )
  expect(entries).toEqual([
    'Nueva venta',
    'Inicio',
    'Ventas',
    'Clientes',
    'Variedades',
    '---',
    'Gastos',
    'Análisis',
    'LHLa Huerta',
  ])
  expect(tabNames(rail(container))).toEqual(RAIL)
  expect(within(rail(container)).queryByRole('link', { name: 'Más' })).not.toBeInTheDocument()
})

test('"Nueva venta" is fixed, apart from the tabs, and goes straight to the sale form', () => {
  renderShell([HOME])

  const links = screen.getAllByRole('link', { name: /Nueva venta/ })
  expect(links).toHaveLength(2)
  for (const link of links) {
    expect(link).toHaveAttribute('href', SALE_NEW)
  }
})

test.each([
  ['a root', HOME, true, true, false],
  ['a root that is Gastos', EXPENSES, true, true, false],
  ['a card: a sale', pathTo(SALE, { id: 7 }), true, false, true],
  ['a card: a customer', pathTo(CUSTOMER, { id: 3 }), true, false, true],
  ['a card: a variety', pathTo(VARIETY, { id: 2 }), true, false, true],
  ['a card: Configuración', SETTINGS, true, false, true],
  ['a form: the sale', SALE_NEW, false, false, false],
  ['a form: a Configuración group', SETTINGS_USERS, false, false, false],
  ['a form: the expense', EXPENSE_NEW, false, false, false],
])(
  '%s: bar %s, "Nueva venta" %s, arrow %s, from the leaf screen\'s kind alone',
  (_kind, path, hasBar, hasButton, hasArrow) => {
    const { container } = renderShell([path])

    expect(container.querySelector('.bar-inferior') !== null).toBe(hasBar)
    expect(container.querySelector('.boton-nueva-venta') !== null).toBe(hasButton)
    expect(screen.queryAllByRole('button', { name: /^‹ / }).length > 0).toBe(hasArrow)
    expect(container.querySelector('.riel-lateral')).not.toBeNull()
  },
)

test.each([
  ['a root', HOME, true],
  ['a card: a sale', pathTo(SALE, { id: 7 }), false],
  ['a card: a customer, the detail pane of Clientes', pathTo(CUSTOMER, { id: 3 }), true],
  ['a card: a variety, the detail pane of Variedades', pathTo(VARIETY, { id: 2 }), true],
  ['a card: Configuración', SETTINGS, false],
  ['a form: the sale', SALE_NEW, false],
])('%s: the rail keeps "Nueva venta" %s, as the computer designs draw it', (_kind, path, inRail) => {
  const { container } = renderShell([path], { computer: true })

  expect(within(rail(container)).queryAllByRole('link', { name: /Nueva venta/ }).length > 0).toBe(inRail)
})

test('on a phone a detail pane has no "Nueva venta" at all', () => {
  renderShell([pathTo(VARIETY, { id: 2 })])

  expect(screen.queryAllByRole('link', { name: /Nueva venta/ })).toHaveLength(0)
})

test.each([
  [HOME, 'Inicio', 'Inicio'],
  [SALES, 'Ventas', 'Ventas'],
  [CUSTOMERS, 'Clientes', 'Clientes'],
  [VARIETIES, 'Variedades', 'Variedades'],
  [pathTo(SALE, { id: 7 }), 'Ventas', 'Ventas'],
  [pathTo(CUSTOMER, { id: 3 }), 'Clientes', 'Clientes'],
  [pathTo(VARIETY, { id: 2 }), 'Variedades', 'Variedades'],
])('on %s each surface marks %s alone, with aria-current', (path, barEntry, railEntry) => {
  const { container } = renderShell([path])

  expect(current(bar(container))).toEqual([barEntry])
  expect(current(rail(container))).toEqual([railEntry])
})

test.each([
  [EXPENSES, 'Gastos'],
  [ANALYSIS, 'Análisis'],
])('on %s the phone marks Más and a computer marks its own entry, %s', (path, railEntry) => {
  const { container } = renderShell([path])

  expect(current(bar(container))).toEqual(['Más'])
  expect(current(rail(container))).toEqual([railEntry])
})

test('Más marks Más on the bar and nothing on the rail, which has no Más', () => {
  const { container } = renderShell([MORE])

  expect(current(bar(container))).toEqual(['Más'])
  expect(current(rail(container))).toEqual([])
})

test('Configuración marks Más on the phone and the business row on a computer', () => {
  const { container } = renderShell([SETTINGS])

  const more = within(bar(container)).getByRole('link', { name: 'Más' })
  expect(more).toHaveAttribute('aria-current', 'page')
  expect(current(bar(container))).toEqual(['Más'])
  const row = within(rail(container)).getByRole('link', { name: 'Configuración de La Huerta' })
  expect(row).toHaveAttribute('aria-current', 'page')
  expect(row.className).toMatch(/--activo/)
  expect(current(rail(container))).toEqual(['LHLa Huerta'])
})

test('a customer card marks Clientes however it was reached: from Inicio, after a reload, from a saved link', async () => {
  const user = userEvent.setup()
  const card = pathTo(CUSTOMER, { id: 3 })
  const fromHome = renderShell([HOME])
  await user.click(screen.getByRole('link', { name: 'Cobrar a Ana' }))
  expect(fromHome.router.state.location.pathname).toBe(card)
  expect(current(bar(fromHome.container))).toEqual(['Clientes'])
  expect(current(rail(fromHome.container))).toEqual(['Clientes'])
  fromHome.unmount()

  // A reload keeps the entry but loses nothing the mark reads: only the leaf screen.
  const reloaded = renderShell([card])
  expect(current(bar(reloaded.container))).toEqual(['Clientes'])
  reloaded.unmount()

  // A saved link opens with a history that holds something unrelated before it.
  const saved = renderShell([SALES, card], { index: 1 })
  expect(current(bar(saved.container))).toEqual(['Clientes'])
})

test('the active mark is more than color: aria-current, a distinct class and nothing on the rest', () => {
  renderShell([HOME])

  for (const link of screen.getAllByRole('link', { name: 'Inicio' })) {
    expect(link).toHaveAttribute('aria-current', 'page')
    expect(link.className).toMatch(/--activo/)
  }
  for (const link of screen.getAllByRole('link', { name: 'Clientes' })) {
    expect(link).not.toHaveAttribute('aria-current')
    expect(link.className).not.toMatch(/--activo/)
  }
})

test('at 320 px with text at 130 %, every bar label is whole: present, visible and not clipped', () => {
  document.documentElement.style.fontSize = '130%'
  try {
    const { container } = renderShell([HOME])
    const labels = within(bar(container)).getAllByRole('link')
    expect(labels.map((link) => link.querySelector('span')?.textContent)).toEqual(BAR)
    for (const link of labels) {
      const label = link.querySelector('span') as HTMLElement
      expect(label).toBeVisible()
      expect(label.scrollWidth).toBeLessThanOrEqual(label.clientWidth)
      expect(label.getAttribute('title')).toBeNull()
    }
  } finally {
    document.documentElement.style.fontSize = ''
  }
})

test('the business row leads to Configuración, carrying inApp, one tap from Inicio', async () => {
  const { container } = renderShell([HOME], { computer: true })
  const row = within(rail(container)).getByRole('link', { name: 'Configuración de La Huerta' })

  expect(row).toHaveAttribute('href', SETTINGS)
  expect(row).toHaveTextContent('LH')
  expect(row).toHaveTextContent('La Huerta')
  expect(rail(container).lastElementChild).toBe(row)
  await userEvent.click(row)

  expect(screen.getByText(`en ${SETTINGS} inApp=true`)).toBeInTheDocument()
})

test('the phone reaches Configuración in two taps: the Más tab, then its Configuración entry', async () => {
  const { container } = renderShell([HOME])

  await userEvent.click(within(bar(container)).getByRole('link', { name: 'Más' }))
  await userEvent.click(
    within(screen.getByRole('navigation', { name: 'Más' })).getByRole('link', { name: /^Configuración/ }),
  )

  expect(screen.getByText(`en ${SETTINGS} inApp=true`)).toBeInTheDocument()
})

test('Inicio\'s teaser opens the card with inApp state; the card reads "‹ Clientes" and Back lands on Inicio', async () => {
  const user = userEvent.setup()
  const { router } = renderShell([HOME])

  await user.click(screen.getByRole('link', { name: 'Cobrar a Ana' }))
  expect(router.state.location.state).toEqual(inAppState({ pathname: HOME }))
  await user.click(screen.getByRole('button', { name: '‹ Clientes' }))

  expect(router.state.location.pathname).toBe(HOME)
})

test('a card opened from Clientes reads "‹ Clientes" and Back lands on Clientes', async () => {
  const user = userEvent.setup()
  const { router } = renderShell([CUSTOMERS])
  await act(() => router.navigate(pathTo(CUSTOMER, { id: 3 }), { state: inAppState({ pathname: HOME }) }))

  await user.click(screen.getByRole('button', { name: '‹ Clientes' }))

  expect(router.state.location.pathname).toBe(CUSTOMERS)
})

test('a card opened directly reads "‹ Clientes" and Back goes to Clientes, replacing the entry', async () => {
  const user = userEvent.setup()
  const { router } = renderShell([SALES, pathTo(CUSTOMER, { id: 3 })], { index: 1 })

  await user.click(screen.getByRole('button', { name: '‹ Clientes' }))

  expect(router.state.location.pathname).toBe(CUSTOMERS)
  expect(router.state.historyAction).toBe('REPLACE')
})

test('a sale and a variety read "‹ Ventas" and "‹ Variedades"', () => {
  const sale = renderShell([pathTo(SALE, { id: 7 })])
  expect(screen.getByRole('button', { name: '‹ Ventas' })).toBeInTheDocument()
  sale.unmount()

  renderShell([pathTo(VARIETY, { id: 2 })])
  expect(screen.getByRole('button', { name: '‹ Variedades' })).toBeInTheDocument()
})

test('Configuración\'s list opened directly reads "‹ Más" on the phone and "‹ Inicio" on a computer', async () => {
  const phone = renderShell([SETTINGS])
  expect(screen.getByRole('button', { name: '‹ Más' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '‹ Inicio' })).not.toBeInTheDocument()
  phone.unmount()

  renderShell([SETTINGS], { computer: true })
  expect(screen.getByRole('button', { name: '‹ Inicio' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '‹ Más' })).not.toBeInTheDocument()
})

test('a root has no arrow', () => {
  renderShell([CUSTOMERS])
  expect(screen.queryByRole('button', { name: /^‹ / })).not.toBeInTheDocument()
})
