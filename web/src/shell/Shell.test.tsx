/**
 * `Shell` at the screen seam, under a memory *data* router: every screen of the registry is
 * mounted as a stub that only says its title, so what the shell draws is the registry's answer
 * for that screen's kind and place, and nothing else (no pathname, no history decides it).
 *
 * The bar is Home, Sales, Customers, Varieties and More; the rail is the first four, a
 * divider, Expenses and Analysis, and the business row, with no More. "+ New sale" is fixed,
 * apart from the tabs, and only a root shows it. A card shows the bar and a "‹ parent" arrow,
 * a form neither. jsdom lays nothing out, so each surface is checked through its markup and
 * `useViewport` is mocked per case for the viewport (its own test owns `matchMedia`).
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, Outlet, RouterProvider, useLocation, type RouteObject } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import type { FirstRunAnswer } from '../api/firstRun'
import type { Me } from '../api/me'
import { expectIconAndTextRule, iconAndTextProblems } from '../test/iconAndTextRule'
import { inAppState } from '../components/inAppState'
import InAppLink from '../components/InAppLink'
import {
  ANALYSIS,
  CATALOG,
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
  VARIETY_PRICE_NEW,
  pathTo,
  type Screen,
} from '../routes'
import Mas from '../screens/Mas'
import Shell from './Shell'

const ME: Me = { email: 'ana@x.com', business_name: 'La Huerta', today: '2026-10-03' }

const BAR = ['Home', 'Sales', 'Customers', 'Varieties', 'More']
const RAIL = ['Home', 'Sales', 'Customers', 'Varieties', 'Expenses', 'Analysis']

const viewport = vi.hoisted(() => ({ current: 'phone' as 'phone' | 'computer' }))

vi.mock('./useViewport', () => ({ useViewport: () => viewport.current }))

/** The tabs only, in the order they render: drops "New sale" and the business row. */
function tabNames(nav: HTMLElement): string[] {
  return within(nav)
    .getAllByRole('link')
    .map((link) => link.textContent)
    .filter(
      (name): name is string =>
        name !== null && !name.startsWith('New sale') && !name.startsWith('LH'),
    )
}

function Landed() {
  const location = useLocation()
  const inApp = (location.state as { inApp?: boolean } | null)?.inApp
  return <div>{`en ${location.pathname} inApp=${String(inApp)}`}</div>
}

/** A stand-in for Home's teaser: an in-app link into a customer's card. */
function Teaser() {
  return <InAppLink to={pathTo(CUSTOMER, { id: 3 })}>Cobrar a Ana</InAppLink>
}

/** Every registered screen as a leaf; Home holds the teaser, More its real list. */
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

/** What the stubbed `GET /first-run` answers; a failed read when it is `undefined`. */
function stubFirstRun(answer: FirstRunAnswer | 'pending' | undefined): void {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      if (!String(input).includes('/first-run')) return Promise.reject(new Error('unexpected fetch'))
      if (answer === 'pending') return new Promise<Response>(() => undefined)
      if (answer === undefined) return Promise.reject(new Error('network error'))
      return Promise.resolve(
        new Response(JSON.stringify(answer), { status: 200, headers: { 'Content-Type': 'application/json' } }),
      )
    }),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

function renderShell(
  entries: string[],
  options: { computer?: boolean; index?: number; firstRun?: FirstRunAnswer | 'pending' } = {},
) {
  stubFirstRun(options.firstRun)
  viewport.current = options.computer === true ? 'computer' : 'phone'
  const router = createMemoryRouter(
    [{ element: <Outlet context={ME} />, children: [{ element: <Shell />, children: SCREENS.map(leaf) }] }],
    { initialEntries: entries, initialIndex: options.index ?? entries.length - 1 },
  )
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const view = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
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

test('the bar is Home, Sales, Customers, Varieties and More, with no Stock', () => {
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

test('the rail is "New sale", four tabs, a divider, Expenses and Analysis, then the business row', () => {
  const { container } = renderShell([HOME], { computer: true })

  const entries = [...rail(container).children].map((child) =>
    child.getAttribute('role') === 'separator' ? '---' : (child.textContent ?? ''),
  )
  expect(entries).toEqual([
    'New sale',
    'Home',
    'Sales',
    'Customers',
    'Varieties',
    '---',
    'Expenses',
    'Analysis',
    'LHLa Huerta',
  ])
  expect(tabNames(rail(container))).toEqual(RAIL)
  expect(within(rail(container)).queryByRole('link', { name: 'More' })).not.toBeInTheDocument()
})

test('"New sale" is fixed, apart from the tabs, and goes straight to the sale form', () => {
  renderShell([HOME])

  const links = screen.getAllByRole('link', { name: /New sale/ })
  expect(links).toHaveLength(2)
  for (const link of links) {
    expect(link).toHaveAttribute('href', SALE_NEW)
  }
})

test.each([
  ['a root', HOME, true, true, false],
  ['a root that is Expenses', EXPENSES, true, true, false],
  ['a card: a sale', pathTo(SALE, { id: 7 }), true, false, true],
  ['a card: a customer', pathTo(CUSTOMER, { id: 3 }), true, false, true],
  // A variety's back names the loaded record, so it shows no arrow until its screen declares one.
  ['a card: a variety', pathTo(VARIETY, { id: 2 }), true, false, false],
  ['a card: Settings', SETTINGS, true, false, true],
  ['a form: the sale', SALE_NEW, false, false, false],
  ['a form: a Settings group', SETTINGS_USERS, false, false, false],
  ['a form: the expense', EXPENSE_NEW, false, false, false],
])(
  '%s: bar %s, "New sale" %s, arrow %s, from the leaf screen\'s kind alone',
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
  ['a card: a customer, the detail pane of Customers', pathTo(CUSTOMER, { id: 3 }), false],
  ['a card: a variety, the detail pane of Varieties', pathTo(VARIETY, { id: 2 }), false],
  ['a root: Customers', CUSTOMERS, true],
  ['a root: Varieties', VARIETIES, true],
  ['a card: Settings', SETTINGS, false],
  ['a form: the sale', SALE_NEW, false],
])('%s: the rail shows "New sale" %s, by the screen\'s kind alone', (_kind, path, inRail) => {
  const { container } = renderShell([path], { computer: true })

  expect(within(rail(container)).queryAllByRole('link', { name: /New sale/ }).length > 0).toBe(inRail)
})

// The chrome rule by what the seller can find: "+ Nueva venta" only on a tab root, a "‹ parent"
// arrow on a card, neither on a form. Controls are found by role and accessible name.
test.each([
  ['Home', HOME],
  ['Varieties', VARIETIES],
])('a root (%s) shows the "+ New sale" control and no arrow', (_name, path) => {
  renderShell([path])

  expect(screen.getAllByRole('link', { name: /New sale/ }).length).toBeGreaterThan(0)
  expect(screen.queryByRole('button', { name: /^‹ / })).not.toBeInTheDocument()
})

test.each([
  ['the catalog on a phone', CATALOG, false, '‹ Variedades'],
  ['the catalog on a computer', CATALOG, true, '‹ Variedades'],
])('a card (%s) shows its "‹ parent" arrow and never "+ Nueva venta"', (_name, path, computer, arrow) => {
  renderShell([path], { computer })

  expect(screen.getByRole('button', { name: arrow })).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: /New sale/ })).not.toBeInTheDocument()
})

// A variety's back names the loaded record, so the shell shows no arrow for it until its screen
// declares one (never a bare '‹' or the registry's 'Variedad'); it still shows no "Nueva venta".
test('a card that is a variety on a phone shows no arrow before its screen declares one, and no "New sale"', () => {
  renderShell([pathTo(VARIETY, { id: 2 })])

  expect(screen.queryByRole('button', { name: /^‹ / })).not.toBeInTheDocument()
  expect(screen.queryByRole('link', { name: /New sale/ })).not.toBeInTheDocument()
})

test.each([
  ['phone', false],
  ['computer', true],
])('the price form (a form) on a %s shows neither the bar, an arrow nor "+ New sale"', (_name, computer) => {
  const { container } = renderShell([pathTo(VARIETY_PRICE_NEW, { id: 2 })], { computer })

  expect(container.querySelector('.bar-inferior')).toBeNull()
  expect(screen.queryByRole('button', { name: /^‹ / })).not.toBeInTheDocument()
  expect(screen.queryByRole('link', { name: /New sale/ })).not.toBeInTheDocument()
})

test('the price form on a computer draws no side rail, and on a phone the rail stays in the markup', () => {
  const computer = renderShell([pathTo(VARIETY_PRICE_NEW, { id: 2 })], { computer: true })
  expect(computer.container.querySelector('.riel-lateral')).toBeNull()
  computer.unmount()

  // The rail is hidden by CSS on a phone; every other form still renders it, so only the
  // price modal's route drops it.
  const other = renderShell([EXPENSE_NEW], { computer: true })
  expect(other.container.querySelector('.riel-lateral')).not.toBeNull()
})

test('on a phone a detail pane has no "New sale" at all', () => {
  renderShell([pathTo(VARIETY, { id: 2 })])

  expect(screen.queryAllByRole('link', { name: /New sale/ })).toHaveLength(0)
})

test.each([
  [HOME, 'Home', 'Home'],
  [SALES, 'Sales', 'Sales'],
  [CUSTOMERS, 'Customers', 'Customers'],
  [VARIETIES, 'Varieties', 'Varieties'],
  [pathTo(SALE, { id: 7 }), 'Sales', 'Sales'],
  [pathTo(CUSTOMER, { id: 3 }), 'Customers', 'Customers'],
  [pathTo(VARIETY, { id: 2 }), 'Varieties', 'Varieties'],
])('on %s each surface marks %s alone, with aria-current', (path, barEntry, railEntry) => {
  const { container } = renderShell([path])

  expect(current(bar(container))).toEqual([barEntry])
  expect(current(rail(container))).toEqual([railEntry])
})

test.each([
  [EXPENSES, 'Expenses'],
  [ANALYSIS, 'Analysis'],
])('on %s the phone marks More and a computer marks its own entry, %s', (path, railEntry) => {
  const { container } = renderShell([path])

  expect(current(bar(container))).toEqual(['More'])
  expect(current(rail(container))).toEqual([railEntry])
})

test('More marks More on the bar and nothing on the rail, which has no More', () => {
  const { container } = renderShell([MORE])

  expect(current(bar(container))).toEqual(['More'])
  expect(current(rail(container))).toEqual([])
})

test('Settings marks More on the phone and the business row on a computer', () => {
  const { container } = renderShell([SETTINGS])

  const more = within(bar(container)).getByRole('link', { name: 'More' })
  expect(more).toHaveAttribute('aria-current', 'page')
  expect(current(bar(container))).toEqual(['More'])
  const row = within(rail(container)).getByRole('link', { name: 'Settings of La Huerta' })
  expect(row).toHaveAttribute('aria-current', 'page')
  expect(row.className).toMatch(/--activo/)
  expect(current(rail(container))).toEqual(['LHLa Huerta'])
})

test('a customer card marks Customers however it was reached: from Home, after a reload, from a saved link', async () => {
  const user = userEvent.setup()
  const card = pathTo(CUSTOMER, { id: 3 })
  const fromHome = renderShell([HOME])
  await user.click(screen.getByRole('link', { name: 'Cobrar a Ana' }))
  expect(fromHome.router.state.location.pathname).toBe(card)
  expect(current(bar(fromHome.container))).toEqual(['Customers'])
  expect(current(rail(fromHome.container))).toEqual(['Customers'])
  fromHome.unmount()

  // A reload keeps the entry but loses nothing the mark reads: only the leaf screen.
  const reloaded = renderShell([card])
  expect(current(bar(reloaded.container))).toEqual(['Customers'])
  reloaded.unmount()

  // A saved link opens with a history that holds something unrelated before it.
  const saved = renderShell([SALES, card], { index: 1 })
  expect(current(bar(saved.container))).toEqual(['Customers'])
})

test('the active mark is more than color: aria-current, a distinct class and nothing on the rest', () => {
  renderShell([HOME])

  for (const link of screen.getAllByRole('link', { name: 'Home' })) {
    expect(link).toHaveAttribute('aria-current', 'page')
    expect(link.className).toMatch(/--activo/)
  }
  for (const link of screen.getAllByRole('link', { name: 'Customers' })) {
    expect(link).not.toHaveAttribute('aria-current')
    expect(link.className).not.toMatch(/--activo/)
  }
})

test('the business row leads to Settings, carrying inApp, one tap from Home', async () => {
  const { container } = renderShell([HOME], { computer: true })
  const row = within(rail(container)).getByRole('link', { name: 'Settings of La Huerta' })

  expect(row).toHaveAttribute('href', SETTINGS)
  expect(row).toHaveTextContent('LH')
  expect(row).toHaveTextContent('La Huerta')
  expect(rail(container).lastElementChild).toBe(row)
  await userEvent.click(row)

  expect(screen.getByText(`en ${SETTINGS} inApp=true`)).toBeInTheDocument()
})

test('the phone reaches Settings in two taps: the More tab, then its Settings entry', async () => {
  const { container } = renderShell([HOME])

  await userEvent.click(within(bar(container)).getByRole('link', { name: 'More' }))
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

test('a sale reads "‹ Ventas"; a variety, whose word is the record\'s, shows no back until declared', () => {
  const sale = renderShell([pathTo(SALE, { id: 7 })])
  expect(screen.getByRole('button', { name: '‹ Ventas' })).toBeInTheDocument()
  sale.unmount()

  renderShell([pathTo(VARIETY, { id: 2 })])
  expect(screen.queryByRole('button', { name: /^‹ / })).not.toBeInTheDocument()
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

test('the bar is a menu of icon + text tabs, none sharing an icon (icon and text rule)', () => {
  const { container } = renderShell([HOME])

  expect(bar(container)).toHaveAttribute('data-menu')
  expectIconAndTextRule(bar(container))
})

test('the rail is a menu too, and no two of its entries share an icon', () => {
  const { container } = renderShell([HOME], { computer: true })

  expect(rail(container)).toHaveAttribute('data-menu')
  // Every entry draws its icon, Expenses and Analysis included; only the business row draws an
  // avatar, not an icon, so it is the one thing that may be left over.
  expect(iconAndTextProblems(rail(container))).toEqual([
    expect.stringContaining('"Settings of La Huerta" is text only'),
  ])
})

test('a bar that repeats an icon is rejected by the rule', () => {
  const { container } = render(
    <nav data-menu>
      <a href="/a">
        <svg aria-hidden="true">
          <path d="M1 1" />
        </svg>
        <span>Uno</span>
      </a>
      <a href="/b">
        <svg aria-hidden="true">
          <path d="M1 1" />
        </svg>
        <span>Dos</span>
      </a>
    </nav>,
  )
  expect(iconAndTextProblems(container)).toEqual([expect.stringContaining('shares its icon with "Uno"')])
})

const MISSING_LINE = 'Cargale un precio a una variedad para poder vender'

function checklist(pricedDone: boolean): FirstRunAnswer {
  return {
    kind: 'checklist',
    checklist: [
      { step: 'priced_variety', required: true, done: pricedDone },
      { step: 'stock_entry', required: true, done: false },
      { step: 'published', required: false, done: false },
      { step: 'second_user', required: false, done: false },
    ],
    import_notice: false,
    nothing_qualifies: true,
  }
}

test.each([
  ['phone', false, 2],
  ['computer', true, 2],
])('%s: while the checklist shows with no priced variety, "New sale" stays a link and says what is missing', async (_name, computer, buttons) => {
  renderShell([HOME], { computer, firstRun: checklist(false) })

  const lines = await screen.findAllByText(MISSING_LINE)
  expect(lines.length).toBeGreaterThan(0)
  const links = screen.getAllByRole('link', { name: /New sale/ })
  expect(links).toHaveLength(buttons)
  for (const link of links) expect(link).toHaveAttribute('href', SALE_NEW)
  for (const link of links) {
    const describedBy = link.getAttribute('aria-describedby')
    expect(describedBy === null ? null : document.getElementById(describedBy)?.textContent).toBe(MISSING_LINE)
  }
})

test.each([
  ['the priced-variety step is done', checklist(true)],
  ['the first-run slot is something else', { ...checklist(false), kind: 'start_varieties' as const, checklist: [] }],
  ['no first-run element shows', { ...checklist(false), kind: 'none' as const, checklist: [] }],
])('no missing line when %s', async (_name, answer) => {
  renderShell([HOME], { firstRun: answer })

  await act(async () => {
    await Promise.resolve()
  })
  await screen.findAllByRole('link', { name: /New sale/ })
  await new Promise((resolve) => setTimeout(resolve, 20))
  expect(screen.queryByText(MISSING_LINE)).not.toBeInTheDocument()
})

test.each([
  ['pending', 'pending' as const],
  ['failed', undefined],
])('while /first-run is %s, "New sale" draws normally, with no line', async (_name, firstRun) => {
  renderShell([HOME], { firstRun })

  const links = screen.getAllByRole('link', { name: /New sale/ })
  expect(links).toHaveLength(2)
  for (const link of links) expect(link).not.toHaveAttribute('aria-describedby')
  await new Promise((resolve) => setTimeout(resolve, 20))
  expect(screen.queryByText(MISSING_LINE)).not.toBeInTheDocument()
})

test('a form shows no "New sale", so it asks nothing of /first-run', async () => {
  renderShell([SALE_NEW], { firstRun: checklist(false) })

  await new Promise((resolve) => setTimeout(resolve, 20))
  expect(screen.queryByText(MISSING_LINE)).not.toBeInTheDocument()
  expect(vi.mocked(fetch)).not.toHaveBeenCalled()
})
