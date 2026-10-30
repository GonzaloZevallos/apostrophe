import type { CopyKey } from './i18n/resources.generated.ts'
import { pageScrollY, setPaymentReturn } from './paymentReturn.ts'
/**
 * The route registry: the one place the front writes a path, and the one place that says
 * what kind of screen each path is. No other file in `web/src` or `web/e2e` carries a route
 * literal (a source scan in `routes.test.ts` fails if one does).
 *
 * Pure data and functions, with no import of any screen: the e2e specs import it too, and
 * they type-check under the node project, which has no JSX. `router.tsx` binds each declared
 * screen to its element (`bind`) and each public page through `outside`.
 *
 * Every screen under `Shell` is declared once with `screen()` and is exactly one `kind` (the
 * Onboarding's forms too, though `OnboardingLayout` draws them instead of `Shell`):
 *   - `root`: a place of its own (the bar or the rail marks it); shows the bar and "+ Nueva venta".
 *   - `card`: a detail; shows the bar and a "‹ parent" arrow, no "+ Nueva venta".
 *   - `form`: a form or sheet; shows neither, and closes with "Cerrar".
 * Every route outside `Shell` (the public pages and the catch-all) is declared with
 * `outside()`; a route is one or the other, never both, never neither.
 *
 * `parentOf` and `placeOf` take the viewport because Configuración's list has a different
 * parent on the phone (Más) than on a computer (Inicio). A card or form has no place of its
 * own: `placeOf` walks its parent chain until a screen that declares one, so the mark never
 * depends on history, a reload or how the screen was opened.
 */

export type Viewport = 'phone' | 'computer'

/** Which kind of screen a route is; the chrome follows from it and from nothing else. */
export type Kind = 'root' | 'card' | 'form'

/** What the bottom bar can mark. */
export type BarPlace = 'home' | 'sales' | 'customers' | 'varieties' | 'more'

/** What the side rail can mark: the bar's places, Gastos, Análisis and the business row. */
export type RailPlace = BarPlace | 'expenses' | 'analysis' | 'business'

export interface Place {
  bar: BarPlace
  rail: RailPlace
}

export type ScreenId =
  | 'home'
  | 'more'
  | 'sales'
  | 'sale-new'
  | 'sale'
  | 'customers'
  | 'customer-new'
  | 'customer'
  | 'customer-edit'
  | 'customer-payment'
  | 'varieties'
  | 'variety'
  | 'variety-new'
  | 'variety-prices'
  | 'variety-price-new'
  | 'variety-entries'
  | 'catalog'
  | 'stock'
  | 'stock-entry-new'
  | 'stock-entry'
  | 'varieties-archived'
  | 'withdrawal-new'
  | 'withdrawal'
  | 'withdrawal-edit'
  | 'expenses'
  | 'expense-new'
  | 'analysis'
  | 'settings'
  | 'settings-business'
  | 'settings-users'
  | 'settings-prices'
  | 'settings-integrations'
  | 'settings-catalog-message'
  | 'settings-expense-categories'
  | 'settings-appearance'
  | 'settings-account'
  | 'onboarding'
  | 'onboarding-variety'
  | 'onboarding-stock'
  | 'onboarding-catalog-message'
  | 'onboarding-bot'
  | 'onboarding-partner'
  | 'onboarding-categories'
  | 'onboarding-done'

/** A screen's parent: one id, or one per viewport. */
export type Parent = ScreenId | { phone: ScreenId; computer: ScreenId }

// Paths. A `:name` segment is a parameter; `pathTo` fills it.
export const HOME = '/'
export const LOGIN = '/login'
export const INVITATION = '/invitation/:token'
export const RESET = '/reset/:token'
export const CATCH_ALL = '*'

export const SALES = '/sales'
export const SALE_NEW = '/sales/new'
export const SALE = '/sales/:id'

export const CUSTOMERS = '/customers'
export const CUSTOMER_NEW = '/customers/new'
export const CUSTOMER = '/customers/:id'
export const CUSTOMER_EDIT = '/customers/:id/edit'
export const CUSTOMER_PAYMENT = '/customers/:id/payment'

export const VARIETIES = '/varieties'
export const VARIETY_NEW = '/varieties/new'
export const ARCHIVED_VARIETIES = '/varieties/archived'
export const VARIETY = '/varieties/:id'
export const VARIETY_PRICES = '/varieties/:id/prices'
export const VARIETY_PRICE_NEW = '/varieties/:id/prices/new'
export const VARIETY_ENTRIES = '/varieties/:id/entries'
export const CATALOG = '/varieties/catalog'

export const STOCK = '/varieties/entries'
export const STOCK_ENTRY_NEW = '/varieties/entries/new'
export const STOCK_ENTRY = '/varieties/entries/:id'

/** The anchor of a variety's "En el catálogo" section: the catalog screen links to it and
 * the variety's page honours it. Not a path. */
export const CATALOG_SECTION_ID = 'en-el-catalogo'

export const WITHDRAWAL_NEW = '/withdrawals/new'
export const WITHDRAWAL = '/withdrawals/:id'
export const WITHDRAWAL_EDIT = '/withdrawals/:id/edit'

/** The withdrawal form with `varietyId` already chosen on its first line. */
export function withdrawalNewFor(varietyId: number | string): string {
  return `${WITHDRAWAL_NEW}?variety=${encodeURIComponent(String(varietyId))}`
}

export const MORE = '/more'
export const EXPENSES = '/expenses'
export const EXPENSE_NEW = '/expenses/new'
export const ANALYSIS = '/analysis'

export const SETTINGS = '/settings'
export const SETTINGS_BUSINESS = '/settings/business'
export const SETTINGS_USERS = '/settings/users'
export const SETTINGS_PRICES = '/settings/prices'
export const SETTINGS_INTEGRATIONS = '/settings/integrations'
export const SETTINGS_CATALOG_MESSAGE = '/settings/catalog-message'
export const EXPENSE_CATEGORIES = '/settings/expense-categories'
export const SETTINGS_APPEARANCE = '/settings/appearance'
export const SETTINGS_ACCOUNT = '/settings/account'

/** The Onboarding (docs/product/onboarding.md): `/onboarding` resolves to the resume step,
 * each step has its own path, and "Listo" is `/onboarding/done`. The API's own segment is
 * `onboarding-progress`, so none of these is a shared route. */
export const ONBOARDING = '/onboarding'
export const ONBOARDING_VARIETY = '/onboarding/variety'
export const ONBOARDING_STOCK = '/onboarding/stock'
export const ONBOARDING_CATALOG_MESSAGE = '/onboarding/catalog-message'
export const ONBOARDING_BOT = '/onboarding/bot'
export const ONBOARDING_PARTNER = '/onboarding/partner'
export const ONBOARDING_CATEGORIES = '/onboarding/categories'
export const ONBOARDING_DONE = '/onboarding/done'

/** Fills a template's `:name` segments: `pathTo(SALE, { id: 7 })` is `/ventas/7`. */
export function pathTo(template: string, params: Readonly<Record<string, string | number>> = {}): string {
  return template.replace(/:([A-Za-z]+)/g, (_match, name: string) => {
    const value = params[name]
    if (value === undefined) throw new Error(`pathTo: ${template} needs ${name}`)
    return encodeURIComponent(String(value))
  })
}

/** The screen Record payment was opened from, which is what sits behind it (ADR-0044). */
export type PaymentUnderneath = 'home' | 'customers' | 'card'

const PAYMENT_UNDERNEATH: readonly PaymentUnderneath[] = ['home', 'customers', 'card']

function isPaymentUnderneath(value: unknown): value is PaymentUnderneath {
  return PAYMENT_UNDERNEATH.some((known) => known === value)
}

/**
 * The only reader of `location.state.underneath`. Anything outside the closed set (an
 * unknown name, a direct link, a reload with no state) gives the customer's card.
 */
export function readPaymentUnderneath(state: unknown): PaymentUnderneath {
  if (typeof state === 'object' && state !== null && 'underneath' in state && isPaymentUnderneath(state.underneath)) {
    return state.underneath
  }
  return 'card'
}

/** Whether the history state carries the screen Record payment was opened over (`paymentLink`
 * wrote it): the signal that the route opens over a screen instead of replacing it. */
export function hasPaymentUnderneath(state: unknown): boolean {
  return typeof state === 'object' && state !== null && 'underneath' in state && isPaymentUnderneath(state.underneath)
}

/** The part of a click the helper looks at: a plain click follows the link, a modified one
 * opens it elsewhere and leaves this page where it is. */
interface LinkClick {
  button: number
  metaKey: boolean
  ctrlKey: boolean
  shiftKey: boolean
  altKey: boolean
}

/**
 * The link to Record payment for a customer, from the screen it is opened from: the only
 * writer of `underneath`, and the only setter of the return-of-place hand-off (the customer
 * and the scroll offset the seller is at, in memory, `paymentReturn.ts`). The state is a
 * closed screen name, never a record (§9).
 */
export function paymentLink(
  customerId: number | string,
  underneath: PaymentUnderneath,
): { to: string; state: { underneath: PaymentUnderneath }; onClick: (event: LinkClick) => void } {
  return {
    to: pathTo(CUSTOMER_PAYMENT, { id: customerId }),
    state: { underneath },
    onClick: (event) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      setPaymentReturn(Number(customerId), pageScrollY())
    },
  }
}

/** The path as a route-table segment (`'/more'` → `'more'`). */
export function relative(path: string): string {
  return path.replace(/^\//, '')
}

interface ScreenBase {
  id: ScreenId
  path: string
  /** The key of the word "‹ <title>" shows when this screen is somebody's parent. */
  titleKey: CopyKey
  /** Which pane a two-pane screen fills; inert until the area issues build the panes. */
  pane?: 'list' | 'detail'
  /**
   * Marks a card whose parent's word depends on the record shown (a variety's name). Such a
   * leaf draws its back only from an override the screen declared for this very record
   * (`useBackParent`), and nothing until then. Only a screen marked here may call the hook.
   */
  backLabel?: 'record'
  /** The route is a modal on a computer: the shell draws no side rail behind its scrim. The
   * only thing that hides the rail; it is never inferred from `pane` or `kind`. */
  modalOnComputer?: true
}

export type Screen =
  | (ScreenBase & { kind: 'root'; place: Place; parent?: undefined })
  | (ScreenBase & { kind: 'card'; parent: Parent; place?: Place })
  | (ScreenBase & { kind: 'form'; parent: Parent; place?: undefined })

/** Declares a screen under `Shell`. Returns it as given: the type is the check. */
export function screen<S extends Screen>(declaration: S): S {
  return declaration
}

export interface Outside {
  path: string
}

/** Declares a route outside `Shell`: a public page or the catch-all. */
export function outside<O extends Outside>(declaration: O): O {
  return declaration
}

export const SCREENS = [
  screen({ id: 'home', path: HOME, kind: 'root', titleKey: 'common:home', place: { bar: 'home', rail: 'home' } }),
  screen({ id: 'more', path: MORE, kind: 'root', titleKey: 'common:more', place: { bar: 'more', rail: 'more' } }),

  screen({ id: 'sales', path: SALES, kind: 'root', titleKey: 'common:sales', place: { bar: 'sales', rail: 'sales' } }),
  screen({ id: 'sale-new', path: SALE_NEW, kind: 'form', titleKey: 'common:newSale', parent: 'sales' }),
  screen({ id: 'sale', path: SALE, kind: 'card', titleKey: 'shell:sale', parent: 'sales' }),

  screen({
    id: 'customers',
    path: CUSTOMERS,
    kind: 'root',
    titleKey: 'common:customers',
    pane: 'list',
    place: { bar: 'customers', rail: 'customers' },
  }),
  screen({ id: 'customer-new', path: CUSTOMER_NEW, kind: 'form', titleKey: 'common:newCustomer', parent: 'customers' }),
  screen({ id: 'customer', path: CUSTOMER, kind: 'card', titleKey: 'shell:customer', pane: 'detail', parent: 'customers' }),
  screen({ id: 'customer-edit', path: CUSTOMER_EDIT, kind: 'form', titleKey: 'common:editCustomer', parent: 'customer' }),
  screen({
    id: 'customer-payment',
    path: CUSTOMER_PAYMENT,
    kind: 'form',
    titleKey: 'common:recordPayment',
    parent: 'customers',
    modalOnComputer: true,
  }),

  screen({
    id: 'varieties',
    path: VARIETIES,
    kind: 'root',
    titleKey: 'common:varieties',
    pane: 'list',
    place: { bar: 'varieties', rail: 'varieties' },
  }),
  screen({ id: 'variety', path: VARIETY, kind: 'card', titleKey: 'common:variety', pane: 'detail', parent: 'varieties', backLabel: 'record' }),
  screen({ id: 'variety-new', path: VARIETY_NEW, kind: 'form', titleKey: 'common:newVariety', parent: 'varieties' }),
  screen({ id: 'variety-prices', path: VARIETY_PRICES, kind: 'card', titleKey: 'common:prices', parent: 'variety', backLabel: 'record' }),
  screen({ id: 'variety-price-new', path: VARIETY_PRICE_NEW, kind: 'form', titleKey: 'common:newPrice', parent: 'variety', modalOnComputer: true }),
  screen({ id: 'variety-entries', path: VARIETY_ENTRIES, kind: 'card', titleKey: 'common:entries', parent: 'variety', backLabel: 'record' }),
  screen({ id: 'catalog', path: CATALOG, kind: 'card', titleKey: 'common:catalog', parent: 'varieties' }),
  screen({ id: 'stock', path: STOCK, kind: 'card', titleKey: 'common:allEntries', parent: 'varieties' }),
  screen({ id: 'stock-entry-new', path: STOCK_ENTRY_NEW, kind: 'form', titleKey: 'common:stockEntry', parent: 'varieties' }),
  screen({ id: 'stock-entry', path: STOCK_ENTRY, kind: 'form', titleKey: 'common:stockEntry', parent: 'stock' }),
  screen({
    id: 'varieties-archived',
    path: ARCHIVED_VARIETIES,
    kind: 'card',
    titleKey: 'common:archived',
    pane: 'list',
    parent: 'varieties',
  }),
  screen({ id: 'withdrawal-new', path: WITHDRAWAL_NEW, kind: 'form', titleKey: 'common:takeFromStock', parent: 'varieties' }),
  screen({ id: 'withdrawal', path: WITHDRAWAL, kind: 'card', titleKey: 'common:withdrawal', parent: 'varieties' }),
  screen({ id: 'withdrawal-edit', path: WITHDRAWAL_EDIT, kind: 'form', titleKey: 'common:takeFromStock', parent: 'withdrawal' }),

  screen({
    id: 'expenses',
    path: EXPENSES,
    kind: 'root',
    titleKey: 'common:expenses',
    place: { bar: 'more', rail: 'expenses' },
  }),
  screen({ id: 'expense-new', path: EXPENSE_NEW, kind: 'form', titleKey: 'shell:newExpense', parent: 'expenses' }),
  screen({
    id: 'analysis',
    path: ANALYSIS,
    kind: 'root',
    titleKey: 'common:analysis',
    place: { bar: 'more', rail: 'analysis' },
  }),

  screen({
    id: 'settings',
    path: SETTINGS,
    kind: 'card',
    titleKey: 'common:settings',
    parent: { phone: 'more', computer: 'home' },
    place: { bar: 'more', rail: 'business' },
  }),
  screen({ id: 'settings-business', path: SETTINGS_BUSINESS, kind: 'form', titleKey: 'common:business', parent: 'settings' }),
  screen({ id: 'settings-users', path: SETTINGS_USERS, kind: 'form', titleKey: 'common:users', parent: 'settings' }),
  screen({ id: 'settings-prices', path: SETTINGS_PRICES, kind: 'form', titleKey: 'common:prices', parent: 'settings' }),
  screen({
    id: 'settings-integrations',
    path: SETTINGS_INTEGRATIONS,
    kind: 'form',
    titleKey: 'shell:integrations',
    parent: 'settings',
  }),
  screen({
    id: 'settings-catalog-message',
    path: SETTINGS_CATALOG_MESSAGE,
    kind: 'form',
    titleKey: 'common:catalogMessage',
    parent: 'settings',
  }),
  screen({
    id: 'settings-expense-categories',
    path: EXPENSE_CATEGORIES,
    kind: 'form',
    titleKey: 'common:expenseCategories',
    parent: 'settings',
  }),
  screen({
    id: 'settings-appearance',
    path: SETTINGS_APPEARANCE,
    kind: 'form',
    titleKey: 'common:appearance',
    parent: 'settings',
  }),
  screen({ id: 'settings-account', path: SETTINGS_ACCOUNT, kind: 'form', titleKey: 'common:yourAccount', parent: 'settings' }),

  // The Onboarding's steps and "Listo" are forms whose parent is Inicio: "Cerrar" and back
  // with no history land there. `router.tsx` draws them in `OnboardingLayout`, the
  // Onboarding's own frame (one centred column, no bar, no rail), not in `Shell`.
  screen({ id: 'onboarding', path: ONBOARDING, kind: 'form', titleKey: 'shell:gettingStarted', parent: 'home' }),
  screen({ id: 'onboarding-variety', path: ONBOARDING_VARIETY, kind: 'form', titleKey: 'common:varietyWithPrice', parent: 'home' }),
  screen({ id: 'onboarding-stock', path: ONBOARDING_STOCK, kind: 'form', titleKey: 'common:initialStock', parent: 'home' }),
  screen({
    id: 'onboarding-catalog-message',
    path: ONBOARDING_CATALOG_MESSAGE,
    kind: 'form',
    titleKey: 'common:catalogMessage',
    parent: 'home',
  }),
  screen({ id: 'onboarding-bot', path: ONBOARDING_BOT, kind: 'form', titleKey: 'common:telegramBot', parent: 'home' }),
  screen({ id: 'onboarding-partner', path: ONBOARDING_PARTNER, kind: 'form', titleKey: 'common:partner', parent: 'home' }),
  screen({
    id: 'onboarding-categories',
    path: ONBOARDING_CATEGORIES,
    kind: 'form',
    titleKey: 'common:expenseCategories',
    parent: 'home',
  }),
  screen({ id: 'onboarding-done', path: ONBOARDING_DONE, kind: 'form', titleKey: 'common:done', parent: 'home' }),
] as const satisfies readonly Screen[]

/** The ids marked `backLabel: 'record'`: the only screens `useBackParent` accepts, by type. */
export type RecordLabelledScreen = Extract<(typeof SCREENS)[number], { backLabel: 'record' }>['id']

/** The Onboarding's screens: drawn by `OnboardingLayout`, outside `Shell` (onboarding.md). */
export const ONBOARDING_SCREENS: ReadonlySet<ScreenId> = new Set<ScreenId>([
  'onboarding',
  'onboarding-variety',
  'onboarding-stock',
  'onboarding-catalog-message',
  'onboarding-bot',
  'onboarding-partner',
  'onboarding-categories',
  'onboarding-done',
])

/** The public pages and the catch-all: every route outside `Shell`. No front code redirects a
 * Spanish path; the server's `LEGACY_FRONT_PATHS` does (308). */
export const OUTSIDE: readonly Outside[] = [
  outside({ path: LOGIN }),
  outside({ path: INVITATION }),
  outside({ path: RESET }),
  outside({ path: CATCH_ALL }),
]

/** The registry entry of one screen. A missing id is a bug in the declaration, so it throws. */
export function screenOf(id: ScreenId): Screen {
  const found = SCREENS.find((candidate) => candidate.id === id)
  if (found === undefined) throw new Error(`routes: no screen declared as ${id}`)
  return found
}

function parentIdOf(entry: Screen, viewport: Viewport): ScreenId | undefined {
  if (entry.parent === undefined) return undefined
  return typeof entry.parent === 'string' ? entry.parent : entry.parent[viewport]
}

export interface ParentRef {
  id: ScreenId
  /** The parent's path template; `pathTo` fills it when the parent has parameters. */
  path: string
  /** The key of the "‹ <title>" label; the component resolves it on every render. */
  titleKey: CopyKey
}

/** The screen's fixed parent: the "‹ parent" label and the back fallback, from one result. */
export function parentOf(id: ScreenId, viewport: Viewport): ParentRef | undefined {
  const parentId = parentIdOf(screenOf(id), viewport)
  if (parentId === undefined) return undefined
  const parent = screenOf(parentId)
  return { id: parent.id, path: parent.path, titleKey: parent.titleKey }
}

/** The bar's and the rail's mark for the screen: its own, else its nearest ancestor's. */
export function placeOf(id: ScreenId, viewport: Viewport): Place {
  const seen = new Set<ScreenId>()
  let entry: Screen | undefined = screenOf(id)
  while (entry !== undefined) {
    if (entry.place !== undefined) return entry.place
    if (seen.has(entry.id)) throw new Error(`routes: ${id} has a parent cycle`)
    seen.add(entry.id)
    const parentId = parentIdOf(entry, viewport)
    entry = parentId === undefined ? undefined : screenOf(parentId)
  }
  throw new Error(`routes: ${id} has no place in its parent chain`)
}

/** Whether `value` names a declared screen; a route's `handle.screen` is checked with it. */
export function isScreenId(value: unknown): value is ScreenId {
  return SCREENS.some((candidate) => candidate.id === value)
}

function matchesTemplate(path: string, template: string): boolean {
  const have = path.split('/')
  const want = template.split('/')
  return (
    have.length === want.length &&
    want.every((segment, index) => (segment.startsWith(':') ? have[index] !== '' : segment === have[index]))
  )
}

/**
 * The declared screen a pathname is, or `undefined` for a pathname outside the table. A static
 * path wins over a parameterised one (`/customers/new` is the form, not a customer's card).
 */
export function screenAtPath(pathname: string): Screen | undefined {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  let best: Screen | undefined
  let bestParams = Number.POSITIVE_INFINITY
  for (const candidate of SCREENS) {
    if (!matchesTemplate(path, candidate.path)) continue
    const params = candidate.path.split('/').filter((segment) => segment.startsWith(':')).length
    if (params < bestParams) {
      best = candidate
      bestParams = params
    }
  }
  return best
}

/** Whether `path` is one of the public pages (Entrar, an invitation, a reset). */
export function isPublicPath(path: string): boolean {
  return [LOGIN, INVITATION, RESET].some((template) => matchesTemplate(path, template))
}
